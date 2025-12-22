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
    origin: isDev
      ? ['http://localhost:4200', 'http://localhost:3000']
      : ['https://use-tudu.com.br', 'https://professional.use-tudu.com.br'],
    credentials: true,
  },
  transports: ['websocket'],
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  afterInit(server: Server) {
    console.log('✅ WebSocket Gateway Inicializado e Servidor Ativo');
  }

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
  handleJoinOrderRoom(client: Socket, referenceId: any, callback: any) {
    // Se vier um objeto {id: '73824485'}, extraímos apenas a string
    const cleanId =
      typeof referenceId === 'object'
        ? referenceId.referenceId || referenceId.id
        : referenceId;
    const roomName = `order:${cleanId}`;

    client.join(roomName);
    console.log(`[WS] Cliente ${client.id} entrou na sala: ${roomName}`);

    if (callback) callback(roomName);
  }

  notifyPaymentSuccess(referenceId: string, payload: any) {
    if (!this.server) {
      console.error(
        '❌ ERRO CRÍTICO: O servidor Socket.io não foi inicializado no Gateway!',
      );
      return;
    }
    const roomName = `order:${referenceId}`;

    // Verificação crucial: Existe alguém nessa sala?
    const connectedSockets = this.server.sockets.adapter.rooms.get(roomName);
    const numClients = connectedSockets ? connectedSockets.size : 0;

    console.log(
      `[WS] Disparando para sala ${roomName}. Clientes conectados agora: ${numClients}`,
    );

    this.server.to(roomName).emit('paymentStatus', payload);
  }
}
