import AppKit
import Foundation
import Vision

guard CommandLine.arguments.count == 2 else { exit(2) }
let url = URL(fileURLWithPath: CommandLine.arguments[1])
guard let image = NSImage(contentsOf: url),
      let tiff = image.tiffRepresentation,
      let bitmap = NSBitmapImageRep(data: tiff),
      let source = bitmap.cgImage else { exit(1) }

let tileWidth = 2000
let tileHeight = 2500
let stepX = 1750
let stepY = 2250
var seen = Set<String>()

for top in stride(from: 0, to: source.height, by: stepY) {
    for left in stride(from: 0, to: source.width, by: stepX) {
        let width = min(tileWidth, source.width - left)
        let height = min(tileHeight, source.height - top)
        let cropRect = CGRect(x: left, y: source.height - top - height, width: width, height: height)
        guard let crop = source.cropping(to: cropRect) else { continue }
        let request = VNRecognizeTextRequest()
        request.recognitionLevel = .accurate
        request.usesLanguageCorrection = true
        request.recognitionLanguages = ["zh-Hans", "en-US"]
        request.minimumTextHeight = 0.003
        try VNImageRequestHandler(cgImage: crop, options: [:]).perform([request])

        for observation in request.results ?? [] {
            guard let candidate = observation.topCandidates(1).first else { continue }
            let box = observation.boundingBox
            let pixelX = Double(left) + box.origin.x * Double(width)
            let pixelY = Double(top) + (1 - box.origin.y - box.size.height) * Double(height)
            let pixelWidth = box.size.width * Double(width)
            let pixelHeight = box.size.height * Double(height)
            let key = "\(candidate.string)|\(Int(pixelX / 20))|\(Int(pixelY / 20))"
            if seen.contains(key) { continue }
            seen.insert(key)
            let row: [String: Any] = [
                "text": candidate.string,
                "confidence": candidate.confidence,
                "x": pixelX,
                "y": pixelY,
                "width": pixelWidth,
                "height": pixelHeight,
            ]
            let data = try JSONSerialization.data(withJSONObject: row, options: [.sortedKeys])
            print(String(decoding: data, as: UTF8.self))
        }
    }
}
