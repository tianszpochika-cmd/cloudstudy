FROM golang:1.24.9-alpine@sha256:8f8959f38530d159bf71d0b3eb0c547dc61e7959d8225d1599cf762477384923 AS build
ARG MINIO_COMPONENT=minio
ARG SOURCE_COMMIT=7aac2a2c5b7c882e68c1ce017d8256be2feea27f
ARG SOURCE_SHA256=71794c2df26aad0cc99e8421c58b7aa2dd55969f979b0e7d1e931042e9fabcd6
RUN apk add --no-cache ca-certificates curl
WORKDIR /source
RUN curl --fail --location --retry 3 "https://codeload.github.com/minio/${MINIO_COMPONENT}/tar.gz/${SOURCE_COMMIT}" -o /tmp/source.tar.gz \
    && echo "${SOURCE_SHA256}  /tmp/source.tar.gz" | sha256sum -c - \
    && tar -xzf /tmp/source.tar.gz --strip-components=1 \
    && rm /tmp/source.tar.gz
ENV GOTOOLCHAIN=local CGO_ENABLED=0
RUN --mount=type=cache,target=/go/pkg/mod --mount=type=cache,target=/root/.cache/go-build \
    go build -trimpath -o /out/storage-tool .

FROM alpine:3.22.2@sha256:4b7ce07002c69e8f3d704a9c5d6fd3053be500b7f1c69fc0d80990c2ad8dd412
ARG MINIO_COMPONENT=minio
ARG SOURCE_COMMIT=7aac2a2c5b7c882e68c1ce017d8256be2feea27f
RUN apk add --no-cache ca-certificates curl
COPY --from=build /out/storage-tool /usr/local/bin/storage-tool
RUN ln -s storage-tool "/usr/local/bin/${MINIO_COMPONENT}"
LABEL org.opencontainers.image.source="https://github.com/minio/${MINIO_COMPONENT}" \
      org.opencontainers.image.revision="${SOURCE_COMMIT}"
ENTRYPOINT ["/usr/local/bin/storage-tool"]
