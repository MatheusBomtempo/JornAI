-- AlterTable
ALTER TABLE "post_versions" ADD COLUMN     "carousel_slides" JSONB,
ADD COLUMN     "rendered_slide_urls" TEXT[] DEFAULT ARRAY[]::TEXT[];
