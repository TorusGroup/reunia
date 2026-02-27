// Type declarations for @vladmandic/face-api
// Used as browser-only dynamic import for face detection and recognition.
// Full types are bundled with the package; this stub prevents TS errors
// when the package is not yet installed (e.g., first-time local setup).

declare module '@vladmandic/face-api' {
  interface FaceDetection {
    score: number
    box: {
      x: number
      y: number
      width: number
      height: number
    }
  }

  interface FaceDescriptor {
    descriptor: Float32Array
    detection: FaceDetection
  }

  interface FaceDetectionWithLandmarks {
    detection: FaceDetection
    landmarks: unknown
  }

  interface FaceDetectionChain {
    withFaceLandmarks(): FaceDetectionWithLandmarksChain
  }

  interface FaceDetectionWithLandmarksChain {
    withFaceDescriptor(): Promise<FaceDescriptor | null>
  }

  interface NeuralNetwork {
    loadFromUri(uri: string): Promise<void>
  }

  interface Nets {
    ssdMobilenetv1: NeuralNetwork
    faceLandmark68Net: NeuralNetwork
    faceRecognitionNet: NeuralNetwork
  }

  export const nets: Nets

  export function detectSingleFace(
    input: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement
  ): FaceDetectionChain
}
