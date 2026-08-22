package com.englishflow.media.domain;

/** A single inclusive byte range; it carries metadata only and never contains media bytes. */
public record ByteRange(long startInclusive, long endInclusive, long totalSize) {

    public ByteRange {
        if (startInclusive < 0 || endInclusive < startInclusive || totalSize <= 0 || endInclusive >= totalSize) {
            throw MediaOperationException.rangeNotSatisfiable("MEDIA_RANGE_INVALID", "byte range is outside the asset");
        }
    }

    public long length() {
        return endInclusive - startInclusive + 1;
    }

    public static ByteRange entire(long totalSize) {
        MediaValidation.positive(totalSize, "totalSize");
        return new ByteRange(0, totalSize - 1, totalSize);
    }

    public static ByteRange parse(String header, long totalSize, boolean supportsRange) {
        MediaValidation.positive(totalSize, "totalSize");
        if (header == null || header.isBlank()) {
            return entire(totalSize);
        }
        if (!supportsRange || !header.matches("bytes=\\d+-\\d*")) {
            throw MediaOperationException.rangeNotSatisfiable("MEDIA_RANGE_INVALID", "only a single byte range is supported");
        }
        String[] bounds = header.substring("bytes=".length()).split("-", -1);
        try {
            long start = Long.parseLong(bounds[0]);
            if (start >= totalSize) {
                throw MediaOperationException.rangeNotSatisfiable("MEDIA_RANGE_INVALID", "range starts beyond asset");
            }
            long end = bounds[1].isBlank() ? totalSize - 1 : Long.parseLong(bounds[1]);
            if (end < start || end >= totalSize) {
                throw MediaOperationException.rangeNotSatisfiable("MEDIA_RANGE_INVALID", "range is outside asset");
            }
            return new ByteRange(start, end, totalSize);
        } catch (NumberFormatException exception) {
            throw MediaOperationException.rangeNotSatisfiable("MEDIA_RANGE_INVALID", "range is not numeric");
        }
    }
}
