import AppKit
import Foundation
import Vision

guard CommandLine.arguments.count == 2 else {
    fputs("usage: ocr-mindmap.swift <image>\n", stderr)
    exit(2)
}

let imageURL = URL(fileURLWithPath: CommandLine.arguments[1])
guard let image = NSImage(contentsOf: imageURL),
      let tiff = image.tiffRepresentation,
      let bitmap = NSBitmapImageRep(data: tiff),
      let cgImage = bitmap.cgImage else {
    fputs("unable to read image\n", stderr)
    exit(1)
}

let request = VNRecognizeTextRequest()
request.recognitionLevel = .accurate
request.usesLanguageCorrection = true
request.recognitionLanguages = ["zh-Hans", "en-US"]
request.minimumTextHeight = 0.00008

try VNImageRequestHandler(cgImage: cgImage, options: [:]).perform([request])

let encoder = JSONEncoder()
encoder.outputFormatting = [.sortedKeys]
for observation in request.results ?? [] {
    guard let candidate = observation.topCandidates(1).first else { continue }
    let box = observation.boundingBox
    let row: [String: Any] = [
        "text": candidate.string,
        "confidence": candidate.confidence,
        "x": box.origin.x,
        "y": box.origin.y,
        "width": box.size.width,
        "height": box.size.height,
    ]
    let data = try JSONSerialization.data(withJSONObject: row, options: [.sortedKeys])
    print(String(decoding: data, as: UTF8.self))
}
