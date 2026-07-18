function base64ToPdfBlob(content: string) {
  const bytes = atob(content);
  const buffer = new Uint8Array(bytes.length);
  for (let index = 0; index < bytes.length; index += 1) {
    buffer[index] = bytes.charCodeAt(index);
  }
  return new Blob([buffer], { type: "application/pdf" });
}

export function base64PdfToObjectUrl(content: string) {
  return URL.createObjectURL(base64ToPdfBlob(content));
}

export function downloadBase64Pdf(filename: string, content: string) {
  const url = URL.createObjectURL(base64ToPdfBlob(content));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename || "report.pdf";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
