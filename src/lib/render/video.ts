import "server-only";
import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import ffprobeInstaller from "@ffprobe-installer/ffprobe";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import sharp from "sharp";
import { putObject } from "../storage";
import { renderTextToSvg } from "./text";
import type { TextSlot } from "./slots";
import {
  VIDEO_WIDTH,
  VIDEO_HEIGHT,
  SAFE_X,
  CARD_WIDTH,
  CARD_PADDING_X,
  CARD_PADDING_Y,
  TITLE_FONT_SIZE,
  TITLE_LINE_HEIGHT,
  TITLE_MAX_TEXT_HEIGHT,
  LOGO_HEIGHT,
  LOGO_GAP,
  FADE_IN_START,
  FADE_IN_END,
  titleTiming,
  type TitleTiming,
  SLIDE_DISTANCE,
  EXIT_SLIDE_DISTANCE,
  buildVideoCardStyles,
  DEFAULT_VIDEO_TEMPLATE,
  needsBlurBackground,
  defaultGroupTop,
  clampGroupTop,
  type VideoCardStyle,
  type CompanyBrandColors,
} from "./video-layout";

ffmpeg.setFfmpegPath(ffmpegInstaller.path);
ffmpeg.setFfprobePath(ffprobeInstaller.path);

/**
 * Final render of the video post: downloads the original video, normalizes it
 * to 9:16 (always the same proportion, whatever format was uploaded), draws on
 * top the title block + company logo with an entry animation (slides + fades
 * in) and an exit (fades out), and re-encodes it into a single MP4 ready for
 * Instagram (Reels).
 *
 * Why a PNG overlay instead of ffmpeg's drawtext: drawtext depends on
 * libfreetype being able to load the font, and Poppins is only available as
 * .woff (@fontsource) — it is not guaranteed that ffmpeg's freetype opens woff
 * on every platform. By generating the block as a PNG (the same vectorized
 * pipeline as the image render), we reuse exactly the same text as the art.
 */

/** Teto do encode — abaixo do maxDuration da rota (ver /api/posts/[id]/video). */
const RENDER_TIMEOUT_MS = 240_000;

/**
 * FIXED frame rate of the output. Without it the output inherited the rate
 * declared in the source: a WebM recorded by the browser declares 1000 fps
 * (1 ms timebase) and came out as a 1000 fps MP4 — 6,004 frames for 6 s, a
 * render 4x slower and rejected by Instagram (Reels accepts up to 60). Slow
 * motion (240 fps) and screen recordings have the same problem. 30 is the
 * recommended value for Reels.
 */
const OUTPUT_FPS = 30;

export interface RenderVideoParams {
  videoUrl: string;
  title: string;
  /** Logo da empresa, centralizada abaixo do texto. */
  logoUrl?: string | null;
  /** Vertical adjustment of the block made in the editor (px, already on a 1080x1920 scale). */
  titleOffsetY?: number;
  /** Fixed style of the card — see buildVideoCardStyles. */
  videoTemplate?: VideoCardStyle["id"];
  /** Cores da marca da empresa (Admin → Empresa), usadas em "Claro"/"Destaque". */
  brandColors?: CompanyBrandColors;
}

export interface VideoProbe {
  durationSec: number;
  width: number;
  height: number;
}

async function downloadToTemp(url: string, suffix: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download media (${res.status}): ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const dest = path.join(os.tmpdir(), `${randomUUID()}${suffix}`);
  await fs.writeFile(dest, buf);
  return dest;
}

/**
 * Duration, dimensions and rotation of the video — basis of the middle frame
 * and of the proportion validation.
 *
 * Dimensions already in the DISPLAYED orientation: a phone filming upright
 * usually records the file "landscape" (1920x1080) with a 90° rotation matrix
 * — ffmpeg rotates the frames by itself when decoding, but the stream's
 * width/height stay those of the file. Without swapping here, an upright video
 * was treated as landscape: a wrong warning in the editor and a render ~2.5x
 * slower, needlessly building the blurred background (measured in production).
 */
export async function probeVideoFile(filePath: string): Promise<VideoProbe> {
  const data = await new Promise<ffmpeg.FfprobeData>((resolve, reject) =>
    ffmpeg.ffprobe(filePath, (err, d) => (err ? reject(err) : resolve(d))),
  );
  const stream = data.streams.find((s) => s.codec_type === "video");
  if (!stream) throw new Error("The uploaded file has no video track.");

  // fluent-ffmpeg exposes the rotation matrix in `rotation`; an old ffprobe
  // (the one in Vercel's Linux build) uses the `rotate` tag. It covers ±90 and ±270.
  const s = stream as typeof stream & { rotation?: string | number; tags?: { rotate?: string } };
  const rotation = Math.abs(Number(s.rotation ?? s.tags?.rotate ?? 0)) % 180;
  const [width, height] =
    rotation === 90 ? [stream.height ?? 0, stream.width ?? 0] : [stream.width ?? 0, stream.height ?? 0];

  // Duration of the VIDEO TRACK, not of the container: the audio is usually a
  // few tenths longer and the title's exit is computed from the end — it has to
  // finish before the last image frame. With no duration on the track it falls
  // back to the container's; with neither (a WebM recorded by the browser/
  // MediaRecorder writes no duration in the header), it reads the last packet
  // — without that the title vanished at ~4s in a 60s video.
  const durationSec =
    Number(stream.duration) || Number(data.format.duration) || (await lastPacketTime(filePath));

  return { durationSec, width, height };
}

/**
 * Timestamp of the last video packet — demux only (no decoding), so it is fast
 * even on a big file. 0 if it cannot be read.
 */
function lastPacketTime(filePath: string): Promise<number> {
  return new Promise((resolve) => {
    execFile(
      ffprobeInstaller.path,
      ["-v", "error", "-select_streams", "v:0", "-show_entries", "packet=pts_time", "-of", "csv=p=0", filePath],
      { maxBuffer: 16 * 1024 * 1024 },
      (err, stdout) => {
        if (err) return resolve(0);
        let max = 0;
        for (const line of stdout.split("\n")) {
          const t = Number.parseFloat(line);
          if (Number.isFinite(t) && t > max) max = t;
        }
        resolve(max);
      },
    );
  });
}

/**
 * scale+crop that normalizes to 9:16 videos that are already tall enough (it
 * only crops top/bottom).
 *
 * WATCH the shape: a function + array.join, like blurPadGraph — NOT a const
 * `template + template` interpolated inside another template. The SWC
 * minifier in the Linux build (Vercel's) lost the last piece of the left-hand
 * template when inlining that const: ffmpeg received
 * "scale=1080:1920crop=1080:1920" and failed with "Option '1920crop' not
 * found". Reproduced with `next build` on WSL; on Windows the server bundle
 * comes out unminified, which is why it always worked locally.
 */
function cropGraph(inputLabel?: string, outputLabel?: string): string {
  const input = inputLabel ? `[${inputLabel}]` : "";
  const output = outputLabel ? `[${outputLabel}]` : "";
  return [
    `${input}scale=${VIDEO_WIDTH}:${VIDEO_HEIGHT}:force_original_aspect_ratio=increase`,
    `crop=${VIDEO_WIDTH}:${VIDEO_HEIGHT}${output}`,
  ].join(",");
}

/**
 * Core of the blurred background: splits the stream in two — one copy becomes
 * the background (enlarged to fill 1080x1920, mirrored and blurred) and the
 * other stays whole, uncropped, fitted on top and centered. Used when the
 * uploaded video is wider than 9:16 (landscape) — instead of cropping the
 * sides to fit, it fills the leftover vertical space with the blurred video
 * itself.
 */
function blurPadGraph(tag: string, inputLabel?: string, outputLabel?: string): string {
  const input = inputLabel ? `[${inputLabel}]` : "";
  const output = outputLabel ? `[${outputLabel}]` : "";
  return [
    `${input}split=2[${tag}bg][${tag}fg]`,
    `[${tag}bg]scale=${VIDEO_WIDTH}:${VIDEO_HEIGHT}:force_original_aspect_ratio=increase,` +
      `crop=${VIDEO_WIDTH}:${VIDEO_HEIGHT},hflip,gblur=sigma=30,eq=brightness=-0.08:saturation=0.85[${tag}bgblur]`,
    `[${tag}fg]scale=${VIDEO_WIDTH}:${VIDEO_HEIGHT}:force_original_aspect_ratio=decrease[${tag}fgfit]`,
    `[${tag}bgblur][${tag}fgfit]overlay=(W-w)/2:(H-h)/2${output}`,
  ].join(";");
}

/**
 * Filter that normalizes any video to 1080x1920: crops top/bottom if it is
 * already tall enough, or uses the blurred background (see above) if it is
 * landscape — in which case nothing of the original image is lost.
 */
function buildNormalizeFilter(
  srcWidth: number,
  srcHeight: number,
  opts: { inputLabel?: string; outputLabel?: string } = {},
): string {
  if (needsBlurBackground(srcWidth, srcHeight)) {
    return blurPadGraph("n", opts.inputLabel, opts.outputLabel);
  }
  return cropGraph(opts.inputLabel, opts.outputLabel);
}

/**
 * fluent-ffmpeg drops from err.message every stderr line that starts with "["
 * or a space — precisely the "[filter @ 0x…] Option 'x' not found" lines that
 * say what really broke. Returns an error with the exact command and the whole
 * stderr (the ~100-line ring) so that does not get lost.
 */
function withFfmpegContext(err: Error, command: string, stderr: string | null): Error {
  return new Error(
    `${err.message}\n--- binary ---\n${ffmpegInstaller.path} (${ffmpegInstaller.version})` +
      `\n--- comando ---\n${command}\n--- stderr ---\n${(stderr ?? "").trim()}`,
  );
}

/**
 * Middle frame of the video, already normalized to 9:16 — it is the background
 * of the preview in the editor, so it has to go through the SAME framing as
 * the final render.
 */
export async function extractMiddleFrame(
  videoUrl: string,
): Promise<{ jpeg: Buffer; probe: VideoProbe }> {
  const srcPath = await downloadToTemp(videoUrl, path.extname(videoUrl) || ".mp4");
  const outPath = path.join(os.tmpdir(), `${randomUUID()}-frame.jpg`);
  try {
    const probe = await probeVideoFile(srcPath);
    const middle = probe.durationSec > 0 ? probe.durationSec / 2 : 0;
    const vf = buildNormalizeFilter(probe.width, probe.height);

    await new Promise<void>((resolve, reject) => {
      let command = "";
      ffmpeg(srcPath)
        .seekInput(middle)
        .outputOptions(["-frames:v 1", `-vf ${vf}`, "-q:v 3"])
        .on("start", (cmd: string) => {
          command = cmd;
        })
        .on("error", (err: Error, _stdout: string | null, stderr: string | null) =>
          reject(withFfmpegContext(err, command, stderr)),
        )
        .on("end", () => resolve())
        .save(outPath);
    });

    return { jpeg: await fs.readFile(outPath), probe };
  } finally {
    await Promise.all([
      fs.unlink(srcPath).catch(() => {}),
      fs.unlink(outPath).catch(() => {}),
    ]);
  }
}

/** Middle frame + upload, returning the public URL and the probe data. */
export async function extractAndStoreMiddleFrame(
  videoUrl: string,
  key: string,
): Promise<{ url: string; probe: VideoProbe }> {
  const { jpeg, probe } = await extractMiddleFrame(videoUrl);
  const { url } = await putObject(key, jpeg, "image/jpeg");
  return { url, probe };
}

/**
 * Overlaid block: a box with the title and, below it, the company logo
 * centered. It comes out with the video's width (1080) to be overlaid at x=0.
 * The box's look (color, border, highlight bar) comes from the style chosen in
 * the editor — see VIDEO_CARD_STYLES; the layout (position of the text and the
 * logo) is always the same in the 3 styles.
 */
async function buildOverlayCardPng(
  title: string,
  style: VideoCardStyle,
  logoUrl?: string | null,
): Promise<{ buffer: Buffer; height: number }> {
  const slot: TextSlot = {
    x: SAFE_X + CARD_PADDING_X,
    y: CARD_PADDING_Y,
    width: CARD_WIDTH - CARD_PADDING_X * 2,
    height: TITLE_MAX_TEXT_HEIGHT,
    fontSize: TITLE_FONT_SIZE,
    color: style.textColor,
    align: "center",
    weight: 700,
    lineHeight: TITLE_LINE_HEIGHT,
    transform: "none",
  };

  const rendered = await renderTextToSvg(title, slot);
  const boxHeight = Math.max(1, Math.round(rendered.height + CARD_PADDING_Y * 2));

  const logo = logoUrl ? await loadLogo(logoUrl) : null;
  const totalHeight = boxHeight + (logo ? LOGO_GAP + logo.height : 0);

  const cardRect = `x="${SAFE_X}" y="0" width="${CARD_WIDTH}" height="${boxHeight}" rx="${style.cardRadius}"`;
  const border = style.cardBorder ? ` stroke="${style.cardBorder}" stroke-width="1.5"` : "";
  const box = `<rect ${cardRect} fill="${style.cardFill}" fill-opacity="${style.cardOpacity}"${border}/>`;

  // The highlight bar is clipped with the same radius as the box so it does not
  // escape the rounded corners.
  const hasAccent = Boolean(style.accentColor) && style.accentHeight > 0;
  const defs = hasAccent ? `<defs><clipPath id="cardClip"><rect ${cardRect}/></clipPath></defs>` : "";
  const accentBar = hasAccent
    ? `<rect x="${SAFE_X}" y="0" width="${CARD_WIDTH}" height="${style.accentHeight}" fill="${style.accentColor}" clip-path="url(#cardClip)"/>`
    : "";

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${VIDEO_WIDTH}" height="${totalHeight}">` +
    `${defs}${box}${accentBar}${rendered.svg}</svg>`;

  let image = sharp(Buffer.from(svg));
  if (logo) {
    image = sharp(await image.png().toBuffer()).composite([
      {
        input: logo.buffer,
        left: Math.round((VIDEO_WIDTH - logo.width) / 2),
        top: boxHeight + LOGO_GAP,
      },
    ]);
  }

  return { buffer: await image.png().toBuffer(), height: totalHeight };
}

/** Logo resized to LOGO_HEIGHT, keeping the proportion. */
async function loadLogo(
  logoUrl: string,
): Promise<{ buffer: Buffer; width: number; height: number } | null> {
  try {
    const res = await fetch(logoUrl);
    if (!res.ok) return null;
    const resized = await sharp(Buffer.from(await res.arrayBuffer()))
      .resize({ height: LOGO_HEIGHT, fit: "inside", withoutEnlargement: false })
      .png()
      .toBuffer();
    const meta = await sharp(resized).metadata();
    return {
      buffer: resized,
      width: meta.width ?? LOGO_HEIGHT,
      height: meta.height ?? LOGO_HEIGHT,
    };
  } catch {
    // The logo is decoration: if the download fails, the video comes out without it instead of breaking.
    return null;
  }
}

/** Progress 0–1 in the interval [start, end], clamped at the ends. */
function clamp01Progress(start: number, end: number): string {
  return `min(1,max(0,(t-${start})/${end - start}))`;
}

/** Smooths a linear 0–1 progress into an easing curve (slow-fast-slow). */
function smoothstep(progress: string): string {
  return `(${progress}*${progress}*(3-2*${progress}))`;
}

/**
 * Y of the overlay over time: slides from bottom to top on entry and a little
 * downwards on exit — always with easing (smoothstep) instead of linear
 * progress, to feel fluid instead of robotic. With no exit window (short
 * video), only the entry.
 */
function yExpr(restY: number, timing: TitleTiming): string {
  const enterEase = smoothstep(clamp01Progress(FADE_IN_START, FADE_IN_END));
  const expr = `${restY}+(1-${enterEase})*${SLIDE_DISTANCE}`;
  if (timing.exitStart === null || timing.exitEnd === null) return expr;
  const exitEase = smoothstep(clamp01Progress(timing.exitStart, timing.exitEnd));
  return `${expr}+${exitEase}*${EXIT_SLIDE_DISTANCE}`;
}

/** Card filters: enters with a fixed fade at the start; exits with a fade relative to the end of the video. */
function cardFilter(timing: TitleTiming): string {
  const fadeIn = `fade=t=in:st=${FADE_IN_START}:d=${FADE_IN_END - FADE_IN_START}:alpha=1`;
  const fadeOut =
    timing.exitStart !== null && timing.exitEnd !== null
      ? `,fade=t=out:st=${timing.exitStart}:d=${round2(timing.exitEnd - timing.exitStart)}:alpha=1`
      : "";
  return `[1:v]format=rgba,${fadeIn}${fadeOut}[txt]`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export async function renderVideoWithAnimatedTitle(
  params: RenderVideoParams,
): Promise<Buffer> {
  const srcPath = await downloadToTemp(params.videoUrl, path.extname(params.videoUrl) || ".mp4");
  const outPath = path.join(os.tmpdir(), `${randomUUID()}-out.mp4`);
  const cardPath = path.join(os.tmpdir(), `${randomUUID()}-card.png`);
  // try/finally: the function instance is reused across requests (Fluid
  // Compute) and /tmp is small — if it only cleaned up on success, every
  // failed render left the source video (up to 100 MB) on disk, and a few
  // failures were enough to break the next renders on that instance.
  try {
    return await renderInTemp(params, srcPath, cardPath, outPath);
  } finally {
    await Promise.all([
      fs.unlink(srcPath).catch(() => {}),
      fs.unlink(cardPath).catch(() => {}),
      fs.unlink(outPath).catch(() => {}),
    ]);
  }
}

async function renderInTemp(
  params: RenderVideoParams,
  srcPath: string,
  cardPath: string,
  outPath: string,
): Promise<Buffer> {
  const probe = await probeVideoFile(srcPath);
  const style = buildVideoCardStyles(params.brandColors)[params.videoTemplate ?? DEFAULT_VIDEO_TEMPLATE];
  const card = await buildOverlayCardPng(params.title || "", style, params.logoUrl);
  await fs.writeFile(cardPath, card.buffer);

  // Block position: by default flush with the end of the safe area, plus the
  // editor's adjustment — always clamped inside the Reels safe area.
  const restY = clampGroupTop(
    defaultGroupTop(card.height) + (params.titleOffsetY ?? 0),
    card.height,
  );

  // Card exit computed from the end of the video: it stays on screen the whole
  // time and goes away shortly before it ends (see titleTiming).
  const timing = titleTiming(probe.durationSec);

  const filterComplex = [
    // fps right at the input: the rest of the graph (and the encode) already
    // works only with the 30 frames/s that will come out — see OUTPUT_FPS.
    `[0:v]fps=${OUTPUT_FPS}[src]`,
    buildNormalizeFilter(probe.width, probe.height, { inputLabel: "src", outputLabel: "main" }),
    cardFilter(timing),
    // eof_action=pass: when the card ends (end of the animation), the video
    // carries on without the overlay until its own end — and the encode ends with it.
    `[main][txt]overlay=x=0:y='${yExpr(restY, timing)}':eval=frame:format=auto:eof_action=pass[outv]`,
  ].join(";");

  await new Promise<void>((resolve, reject) => {
    const command = ffmpeg()
      .input(srcPath)
      .input(cardPath)
      // The PNG is a single frame: `-loop 1` turns it into a continuous stream and
      // `-t` limits it to the animation window. Without this `-t`, the card
      // stream is INFINITE and the encode never ends when the source video has no
      // audio track (`-shortest` only anchors on an unfiltered stream, so it cuts
      // nothing and ffmpeg keeps duplicating the last frame forever).
      .inputOptions(["-loop", "1", "-t", String(timing.cardEnd)])
      .complexFilter(filterComplex)
      .outputOptions([
        "-map [outv]",
        "-map 0:a?",
        "-c:v libx264",
        "-preset veryfast",
        "-crf 21",
        "-pix_fmt yuv420p",
        "-c:a aac",
        "-b:a 128k",
        "-movflags +faststart",
      ]);

    // Safety net: without this, any encode that never finishes leaves the
    // reporter's screen on "generating the video…" forever, with no error at all.
    const timer = setTimeout(() => {
      command.kill("SIGKILL");
      reject(new Error(`The video render exceeded ${RENDER_TIMEOUT_MS / 1000}s and was interrupted.`));
    }, RENDER_TIMEOUT_MS);

    let commandLine = "";
    command
      .on("start", (cmd: string) => {
        commandLine = cmd;
      })
      .on("error", (err: Error, _stdout: string | null, stderr: string | null) => {
        clearTimeout(timer);
        reject(withFfmpegContext(err, commandLine, stderr));
      })
      .on("end", () => {
        clearTimeout(timer);
        resolve();
      })
      .save(outPath);
  });

  return fs.readFile(outPath);
}

/** Render + upload to storage, returning the public URL. */
export async function renderVideoAndStore(
  params: RenderVideoParams,
  key: string,
): Promise<string> {
  const buf = await renderVideoWithAnimatedTitle(params);
  const { url } = await putObject(key, buf, "video/mp4");
  return url;
}
