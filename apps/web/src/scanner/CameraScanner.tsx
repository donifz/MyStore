import { useEffect, useRef, useState } from 'react';

type Detector = {
  detect(source: HTMLVideoElement): Promise<Array<{ rawValue?: string }>>;
};
type DetectorConstructor = new (options?: { formats?: string[] }) => Detector;

export default function CameraScanner({
  onScan,
  onClose,
}: {
  onScan: (code: string) => void;
  onClose: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let stopped = false;
    const DetectorClass = (
      window as unknown as { BarcodeDetector?: DetectorConstructor }
    ).BarcodeDetector;
    if (!DetectorClass) {
      setError(
        'Камера с распознаванием штрихкодов не поддерживается этим браузером.',
      );
      return () => undefined;
    }
    const detector = new DetectorClass({
      formats: [
        'ean_13',
        'ean_8',
        'code_128',
        'upc_a',
        'upc_e',
        'itf',
        'qr_code',
      ],
    });
    async function start() {
      try {
        const current = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        if (stopped) {
          current.getTracks().forEach((track) => track.stop());
          return;
        }
        stream.current = current;
        if (video.current) {
          video.current.srcObject = current;
          await video.current.play();
        }
        while (!stopped && video.current) {
          try {
            const matches = await detector.detect(video.current);
            const code = matches
              .find((match) => match.rawValue?.trim())
              ?.rawValue?.trim();
            if (code) {
              onScan(code);
              onClose();
              break;
            }
          } catch {
            // Keep scanning; a frame can be unavailable while the camera starts.
          }
          await new Promise((resolve) => window.setTimeout(resolve, 180));
        }
      } catch {
        setError(
          'Не удалось открыть камеру. Разрешите доступ к камере или введите код вручную.',
        );
      }
    }
    void start();
    return () => {
      stopped = true;
      stream.current?.getTracks().forEach((track) => track.stop());
      stream.current = null;
    };
  }, [onClose, onScan]);

  return (
    <div
      className="camera-scanner"
      role="dialog"
      aria-label="Сканирование камерой"
    >
      <video ref={video} muted playsInline />
      <p className={error ? 'error' : 'muted'}>
        {error || 'Наведите камеру на штрихкод'}
      </p>
      <button type="button" onClick={onClose}>
        Закрыть камеру
      </button>
    </div>
  );
}
