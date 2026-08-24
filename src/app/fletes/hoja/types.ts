export type CellFormat = {
  fontFamily?: string;
  bold?: boolean;
  textColor?: string;
  backgroundColor?: string;
};

export type CellFormatMap = Record<string, CellFormat>;