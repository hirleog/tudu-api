import {
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

const isDev = process.env.NODE_ENV !== 'production';

const corsOrigins = isDev
  ? ['http://localhost:4200', 'http://localhost:3000', 'http://localhost:3001']
  : ['https://use-tudu.com.br', 'https://professional.use-tudu.com.br'];

@WebSocketGateway({
  cors: {
    origin: ['https://use-tudu.com.br', 'https://professional.use-tudu.com.br'],
    credentials: true,
  },
  transports: ['websocket'],
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
  }

  // Exemplo: chamada feita quando prestador atualiza status
  notifyClientStatusChange(pedidoId: string, newStatus: string) {
    this.server.emit('atualizacao-pedido', {
      pedidoId,
      newStatus,
    });
  }

  notificarAtualizacao(card: any) {
    this.server.emit('atualizacao-pedido', {
      id: card.id_pedido,
      status: card.status_pedido,
    });
  }

  notificarNovaCandidatura(payload: {
    id_pedido: string;
    prestador_id: string;
  }) {
    this.server.to(payload.id_pedido).emit('nova-candidatura', payload);
    console.log('chamou notificarNovaCandidatura', payload);
  }

  // Emite para todos os clientes o alerta de nova candidatura para um pedido específico
  emitirAlertaNovaCandidatura(id_pedido: string) {
    this.server.emit('alerta-nova-candidatura', { id_pedido });
    console.log('chamou emitirAlertaNovaCandidaturaa', id_pedido);
  }

  // PAGBANK
  /**
   * 🚨 NOVO: Escuta o evento 'joinOrderRoom' do Frontend
   * Adiciona o cliente (socket) à sala específica do pedido (room).
   * O nome do evento ('joinOrderRoom') deve ser o mesmo usado no Front.
   */
  @SubscribeMessage('joinOrderRoom')
  handleJoinOrderRoom(client: Socket, referenceId: string): void {
    const roomName = `order:${referenceId}`;

    // Adiciona o socket atual à "sala" (room) com o nome do pedido
    client.join(roomName);
    console.log(`[WS] Cliente ${client.id} entrou na sala: ${roomName}`);

    // Opcional: Notificar o cliente que ele entrou na sala (ACK)
    // client.emit('joinedRoom', roomName);
  } // Exemplo: chamada feita quando prestador atualiza status
  // ... (outros métodos)
  // PAGBANK (Manter como está)

  notifyPaymentSuccess(referenceId: string, payload: any) {
    // Usa o mesmo nome de sala definido acima
    const roomName = `order:${referenceId}`; // Emite o evento 'paymentStatus' para a sala

    this.server.to(roomName).emit('paymentStatus', payload);
  }
}
