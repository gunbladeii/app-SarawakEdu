module.exports = async function oracleReference(request, response) {
  const { handleOracleReferenceRequest } = await import("../lib/oracle-reference.mjs");
  return handleOracleReferenceRequest(request, response);
};
