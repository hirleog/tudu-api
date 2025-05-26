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
    origin: corsOrigins,
    credentials: true,
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
