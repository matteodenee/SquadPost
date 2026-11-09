export type PosterKind = 'starters' | 'finishers' | 'presentation';

export type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type FocalPoint = {
  x: number;
  y: number;
  zoom?: number;
};

export type CropSettings = {
  fit?: 'cover' | 'contain';
  containPosition?: 'center' | 'bottom';
  trimTransparent?: boolean;
  zoom?: number;
  offsetX?: number;
  offsetY?: number;
  focalPoint?: Pick<FocalPoint, 'x' | 'y'>;
};

export type Player = {
  id: string;
  name: string;
  photoPath?: string;
  sportPosition?: string;
  jerseyNumber?: number;
  focalPoint?: FocalPoint;
  crop?: CropSettings;
};

export type MatchConfiguration = {
  id: string;
  starters: Player[];
  finishers: Player[];
  fields: Record<string, string>;
  images?: Record<string, string>;
};

export type TextStyle = {
  fontFamily: string;
  fontSize: number;
  minFontSize: number;
  fontWeight: number;
  fontStyle?: 'normal' | 'italic';
  color: string;
  backgroundColor: string;
  horizontalPadding: number;
};

export type PhotoMask =
  | {
      mode: 'neutral-background';
      minLuminance: number;
      maxLuminance: number;
      maxChannelDelta: number;
    }
  | {
      mode: 'rounded-rectangle';
      cornerRadius: number;
      cutouts?: Rect[];
    };

export type FrameStyle = {
  color: string;
  strokeWidth: number;
  cornerRadius: number;
};

export type NumberStyle = {
  box: Rect;
  renderMode?: 'badge' | 'text-only';
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  color: string;
  fontFamily: string;
  fontSize: number;
};

export type BannerStyle = {
  fill: string;
  slant: number;
};

export type PlayerSlot = {
  id: string;
  order: number;
  fixedDisplayNumber: number;
  sportPositionHint?: string;
  photo: Rect & { mask: PhotoMask; cropDefaults?: CropSettings };
  frame?: Rect & { style: FrameStyle };
  number?: NumberStyle;
  name: Rect & {
    style: TextStyle;
    banner?: BannerStyle;
    renderMode?: 'clean-and-text' | 'text-only';
  };
};

export type FieldSlot = {
  key: string;
  box: Rect;
  style: TextStyle;
};

export type GraphicRegion = {
  id: string;
  box: Rect;
  fill: string;
  borderColor?: string;
  borderWidth?: number;
  cornerRadius?: number;
};

export type ImageSlot = {
  key: string;
  box: Rect;
  fit: 'contain' | 'cover';
};

export type ProtectedRegion = {
  id: string;
  box: Rect;
};

export type LayoutManifest = {
  schemaVersion: 1;
  id: string;
  kind: PosterKind;
  canvas: { width: number; height: number };
  sourceCanvas?: { width: number; height: number; fit: 'cover' | 'contain' | 'fill' };
  playerCollection?: 'starters' | 'finishers';
  requiredPlayerCount?: number;
  playerSlots: PlayerSlot[];
  fieldSlots: FieldSlot[];
  graphicRegions?: GraphicRegion[];
  protectedRegions?: ProtectedRegion[];
  imageSlots?: ImageSlot[];
  layerOrder?: Array<
    | 'graphicRegions'
    | 'photos'
    | 'protections'
    | 'frames'
    | 'numbers'
    | 'nameBanners'
    | 'names'
    | 'images'
    | 'fields'
  >;
  fixedArtwork?: string[];
};

export type RenderPosterOptions = {
  manifest: LayoutManifest;
  backgroundPath: string;
  match: MatchConfiguration;
  outputPath: string;
};

export type PosterSetDefinition = {
  kind: PosterKind;
  manifestPath: string;
  backgroundPath: string;
  outputPath: string;
};
