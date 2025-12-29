// card.mapper.ts - Crie este arquivo para limpar o retorno da API
export class CardMapper {
  static toDto(card: any, prestadorId?: number) {
    const ultimoPagamento = card.pagamentos?.[0];

    return {
      id_pedido: card.id_pedido,
      id_cliente: card.id_cliente.toString(),
      status_pedido: card.status_pedido,
      categoria: card.categoria,
      valor: card.valor.toString(),
      address: {
        city: card.city,
        state: card.state,
        // ... demais campos de endereço
      },
      chargeInfos: {
        charge_id: ultimoPagamento?.charge_id || null,
        total_amount: ultimoPagamento?.total_amount
          ? (ultimoPagamento.total_amount / 100).toFixed(2)
          : null,
      },
      createdAt: card.createdAt,
      updatedAt: card.updatedAt,
      // Lógica de candidaturas simplificada
      candidaturas: card.Candidatura.map((c) => ({
        id: c.id_candidatura,
        status: c.status,
        prestador_id: c.prestador_id,
      })).filter((c) => (prestadorId ? c.prestador_id === prestadorId : true)),
    };
  }
}
