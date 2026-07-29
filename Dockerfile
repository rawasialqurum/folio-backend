FROM node:18-bullseye

# System tools:
# - libreoffice: Office <-> PDF conversion
# - ghostscript: PDF compression, PDF -> image rendering
# - qpdf: password lock/unlock (encryption)
# - poppler-utils: pdftoppm/pdftotext helpers
RUN apt-get update && apt-get install -y --no-install-recommends \
    libreoffice \
    ghostscript \
    qpdf \
    poppler-utils \
    fonts-dejavu \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

RUN mkdir -p /app/tmp /app/public_files

ENV PORT=8080
EXPOSE 8080

CMD ["node", "server.js"]
