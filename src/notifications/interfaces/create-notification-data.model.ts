interface CreateNotificationData {
  title: string;
  body: string;
  icon: string;
  id_pedido: string;
  clienteId?: number | null;
  prestadorId?: number | null;
  status?: string;
}