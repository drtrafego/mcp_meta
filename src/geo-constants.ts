// Keys de estados brasileiros confirmados via Meta API em 22/03/2026

export const ESTADOS_BR: Record<string, string> = {
  // Sudeste
  'SP': '460',  // São Paulo
  'RJ': '454',  // Rio de Janeiro
  'MG': '449',  // Minas Gerais
  'ES': '445',  // Espírito Santo

  // Sul
  'PR': '452',  // Paraná
  'SC': '459',  // Santa Catarina
  'RS': '456',  // Rio Grande do Sul

  // Centro-Oeste
  'GO': '462',  // Goiás
  'MT': '448',  // Mato Grosso
  'MS': '446',  // Mato Grosso do Sul
  'DF': '444',  // Distrito Federal

  // Norte
  'AC': '438',  // Acre
  'AP': '440',  // Amapá
  'AM': '441',  // Amazonas
  'PA': '450',  // Pará
  'RO': '457',  // Rondônia
  'RR': '458',  // Roraima
  'TO': '464',  // Tocantins

  // Nordeste
  'AL': '439',  // Alagoas
  'BA': '442',  // Bahia
  'CE': '443',  // Ceará
  'MA': '447',  // Maranhão
  'PB': '451',  // Paraíba
  'PE': '463',  // Pernambuco
  'PI': '453',  // Piauí
  'RN': '455',  // Rio Grande do Norte
  'SE': '461',  // Sergipe
};

// Agrupamentos prontos para uso — o usuário escolhe qual usar
export const REGIOES = {
  SUL:          ['PR','SC','RS'],
  SUDESTE:      ['SP','RJ','MG','ES'],
  CENTRO_OESTE: ['GO','MT','MS','DF'],
  NORTE:        ['AC','AP','AM','PA','RO','RR','TO'],
  NORDESTE:     ['AL','BA','CE','MA','PB','PE','PI','RN','SE'],
};

// Helpers para montar targeting
export function estadosParaKeys(siglas: string[]): Array<{key: string}> {
  return siglas.map(s => {
    const key = ESTADOS_BR[s.toUpperCase()];
    if (!key) throw new Error(`Estado '${s}' não encontrado em ESTADOS_BR`);
    return { key };
  });
}
