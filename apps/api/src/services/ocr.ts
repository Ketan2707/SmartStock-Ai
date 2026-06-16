import Tesseract from 'tesseract.js'

export async function extractTextFromBuffer(imageBuffer: Buffer, mimeType: string): Promise<string> {
  // Convert buffer to base64 data URL for Tesseract
  const base64 = imageBuffer.toString('base64')
  const dataUrl = `data:${mimeType};base64,${base64}`

  const { data } = await Tesseract.recognize(dataUrl, 'eng+hin', {
    logger: () => {}, // suppress progress logs
  })

  return data.text ?? ''
}
