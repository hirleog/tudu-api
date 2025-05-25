import {
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: '*', // configure corretamente em produção
  },
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
}
