export interface CardDetail {
  label: string;
  value: string;
}

export interface Card {
  id: number;
  icon: string;
  cardDetail: CardDetail;
  disabled: boolean;
}