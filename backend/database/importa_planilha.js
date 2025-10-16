const xlsx = require("xlsx");
const path = require("path");
const sqlite3 = require("sqlite3");

const USUARIO_ID = 2;
const CAMINHO_PLANILHA = path.join(__dirname, "kinvo--extrato-carteira 05_08_2025 7_56.xlsx");
const ABA_PLANILHA = "Exemplo";
const CAMINHO_BANCO = path.join(__dirname, "financeiro.db");

// Função para converter valores no formato brasileiro para número
function parseValorBr(valor) {
  if (valor == null) return 0;
  if (typeof valor === "number") return valor;
  return parseFloat(valor.replace(/\./g, "").replace(",", "."));
}

// Converter data do Excel para Date
function excelDateToJSDate(excelDate) {
  if (!excelDate) return null;
  if (excelDate instanceof Date) return excelDate;
  if (typeof excelDate === "number") {
    return new Date(Math.round((excelDate - 25569) * 86400 * 1000));
  }
  const partes = String(excelDate).split("/");
  if (partes.length === 3) {
    return new Date(partes[2], partes[1] - 1, partes[0]);
  }
  return new Date(excelDate);
}

function runAsync(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

(async () => {
  const db = new sqlite3.Database(CAMINHO_BANCO);
  const workbook = xlsx.readFile(CAMINHO_PLANILHA);
  const sheet = workbook.Sheets[ABA_PLANILHA];
  let dados = xlsx.utils.sheet_to_json(sheet);

  console.log(`📌 Registros encontrados na planilha: ${dados.length}`);

  // Limpa os investimentos do usuário 2
  await runAsync(db, "DELETE FROM investimentos WHERE usuario_id = ?", [USUARIO_ID]);

  let inseridos = 0;

  await runAsync(db, "BEGIN TRANSACTION");

  for (let i = 0; i < dados.length; i++) {
    const linha = dados[i];

    const dataOperacao = excelDateToJSDate(linha["Data"]);
    const nomeInvestimento = String(linha["Produto"]).split(" -")[0].trim();
    const tipo = String(linha["Tipo"]).trim();
    const subcategoria = tipo === "Ação" ? "Ação BR" : tipo;
    const categoria = "Renda Variável";

    const quantidade = parseValorBr(linha["Quantidade"]);
    const valorUnitario = parseValorBr(linha["Valor"]);
    const valorTotal = parseValorBr(linha["Valor Total"]);

    await runAsync(
      db,
      `INSERT INTO investimentos 
        (usuario_id, categoria, subcategoria, nome_investimento, tipo_operacao, quantidade, valor_unitario, valor_total, data_operacao, observacao)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        USUARIO_ID,
        categoria,
        subcategoria,
        nomeInvestimento,
        "compra",
        quantidade,
        valorUnitario,
        valorTotal,
        dataOperacao ? dataOperacao.toISOString().split("T")[0] : null,
        null
      ]
    );

    inseridos++;
    if ((i + 1) % 20 === 0 || i === dados.length - 1) {
      console.log(`📊 Processados: ${i + 1}/${dados.length} | Inseridos: ${inseridos}`);
    }
  }

  await runAsync(db, "COMMIT");

  console.log("✅ Importação de investimentos concluída!");
  console.log(`📌 Registros inseridos: ${inseridos}`);

  db.close();
})();
