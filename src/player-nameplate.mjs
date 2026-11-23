import { CanvasTexture, SRGBColorSpace } from 'three';

const height = 46;
const maximumWidth = 300;
const padding = 16;
const font = '600 25px system-ui, sans-serif';
const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

export function playerNameplate(text) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  context.font = font;
  const available = maximumWidth - 2 * padding;
  let title = text;
  if (context.measureText(title).width > available) {
    let prefix = '';
    for (const { segment } of graphemes.segment(title)) {
      if (context.measureText(prefix + segment + '…').width > available) break;
      prefix += segment;
    }
    title = prefix.trimEnd() + '…';
  }

  canvas.width = Math.ceil(context.measureText(title).width) + 2 * padding;
  canvas.height = height;
  context.beginPath();
  context.roundRect(2, 2, canvas.width - 4, height - 4, 16);
  context.fillStyle = '#163b3f';
  context.fill();
  context.strokeStyle = '#a4d3bd';
  context.lineWidth = 2;
  context.stroke();
  context.font = font;
  context.fillStyle = '#f6edda';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(title, canvas.width / 2, height / 2);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.generateMipmaps = false;
  return { texture, width: canvas.width, height };
}
