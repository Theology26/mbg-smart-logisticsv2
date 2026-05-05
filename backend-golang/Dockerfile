# ============================================================================
# MBG Smart Logistics — Golang API Dockerfile (Multi-stage)
# ============================================================================

FROM golang:alpine AS builder

WORKDIR /app

# Install git for Go module downloads
RUN apk add --no-cache git

# Copy go.mod and go.sum first for dependency caching
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build the binary
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o /server ./cmd/server

# ── Stage 2: Runtime ──
FROM alpine:3.19

WORKDIR /app

# Install timezone data and CA certs
RUN apk add --no-cache ca-certificates tzdata

# Set timezone
ENV TZ=Asia/Jakarta

# Copy binary from builder
COPY --from=builder /server /app/server

# Expose API port
EXPOSE 8080

# Run
CMD ["/app/server"]
