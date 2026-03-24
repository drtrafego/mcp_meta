export interface Cenario {
  account_id:          string;
  page_id:             string;
  instagram_user_id:   string;
  whatsapp_number:     string;
  moeda:               'BRL' | 'USD' | 'ARS';
  timezone:            string;
  descricao:           string;
}

export const cenarios: Record<string, Cenario> = {
  drtrafego_esp: {
    account_id:          'act_663136558021878',
    page_id:             '109902140539351',
    instagram_user_id:  '17841400718350027',
    whatsapp_number:     '+5491164067632',
    moeda:               'BRL',
    timezone:            'America/Sao_Paulo',
    descricao:           'DR.Tráfego Principal — dr.trafego esp'
  },
  drtrafego_02: {
    account_id:          'act_483057812600874',
    page_id:             'A_DEFINIR',
    instagram_user_id:  'A_DEFINIR',
    whatsapp_number:     'A_DEFINIR',
    moeda:               'BRL',
    timezone:            'America/Sao_Paulo',
    descricao:           'DR.Tráfego conta 02'
  },
  drtrafego_ig: {
    account_id:          'act_500496247592684',
    page_id:             'A_DEFINIR',
    instagram_user_id:  'A_DEFINIR',
    whatsapp_number:     'A_DEFINIR',
    moeda:               'BRL',
    timezone:            'America/Sao_Paulo',
    descricao:           'DR.Tráfego IG'
  }
};

export function getCenario(id: string): Cenario {
  const c = cenarios[id];
  if (!c) throw new Error(
    `Cenário '${id}' não encontrado. Disponíveis: ${Object.keys(cenarios).join(', ')}`
  );
  return c;
}

export function listCenarios() {
  return Object.entries(cenarios).map(([id, c]) => ({
    id, descricao: c.descricao, account_id: c.account_id
  }));
}
