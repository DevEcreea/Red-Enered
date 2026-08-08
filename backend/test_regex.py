import re

text = """Subtotal S/ 761.12
IGV S/ 137.00
Total S/ 898.12
Dirección de envío
ROSANDINA S.A.C.
CAL. LUIS MONTERO MZA. K LOTE 3 URB. SANTO
DOMINGUITO
Trujillo
13001Trujillo
La Libertad
Perú
ROSANDINA S.A.C., Sonia Mantilla
CAL. LUIS MONTERO MZA. K LOTE 3 URB.
SANTO DOMINGUITO
Trujillo
13001Trujillo
La Libertad
Perú
RUC: 20440382003
Fecha de factura
01/07/2026
Fecha de vencimiento
16/07/2026
Fecha de entrega
01/07/2026
Origen
COT00529
Referencia
COT00529
Descripción Cantidad Precio unitario Impuestos Importe
[2010100001] 2012021_DIESEL B5 S-50 45.291 Gal 16.805085 IGV 18% S/ 761.12
PLACA: TAU841
Términos de pago: 15 días (Crédito)
Comunicación del pago: F 003- 00000297
en esta cuenta: 570-9918610-0-53 - Banco De Credito Del
Peru
SON: OCHOCIENTOS NOVENTA Y OCHO Y 12/100 SOL
Factura electrónica F003-00000297
Enered | Soluciones Integrales para Flotas
Energix Peru E.I.R.L.
RUC 20609304082
Av. Fatima Nro. 127
13001 Trujillo
Perú
997389536 / comercial@energix.pe / comercial@enered.pe /https://www.energix.pe Página 1 / 2"""

print("fecha:", re.search(r'Fecha de (?:emisión|factura)\s+(\d{2}/\d{2}/\d{4})', text, re.IGNORECASE).group(1) if re.search(r'Fecha de (?:emisión|factura)\s+(\d{2}/\d{2}/\d{4})', text, re.IGNORECASE) else None)
print("estacion:", re.search(r'Factura electrónica.*?\n([^\n]+)\nRUC\s+206', text, re.IGNORECASE | re.DOTALL).group(1).strip() if re.search(r'Factura electrónica.*?\n([^\n]+)\nRUC\s+206', text, re.IGNORECASE | re.DOTALL) else None)
print("ruc:", re.search(r'RUC[:\s]+(\d{11})', text, re.IGNORECASE).group(1) if re.search(r'RUC[:\s]+(\d{11})', text, re.IGNORECASE) else None)
print("documento:", re.search(r'F\d{3}-\d+', text).group(0) if re.search(r'F\d{3}-\d+', text) else None)
print("galones:", float(re.search(r'(\d+\.\d+)\s*Gal', text, re.IGNORECASE).group(1)) if re.search(r'(\d+\.\d+)\s*Gal', text, re.IGNORECASE) else None)
print("importe:", float(re.search(r'Total\s*S/\s*([\d,]+\.\d+)', text).group(1).replace(",", "")) if re.search(r'Total\s*S/\s*([\d,]+\.\d+)', text) else None)
print("precio:", float(re.search(r'Gal\s+([\d\.]+)\s+IGV', text).group(1)) if re.search(r'Gal\s+([\d\.]+)\s+IGV', text) else None)
print("placa:", re.search(r'PLACA[:\s]+([A-Z0-9\-]+)', text).group(1) if re.search(r'PLACA[:\s]+([A-Z0-9\-]+)', text) else None)
print("producto:", re.search(r'(DIESEL\s+B5.*?|GASOHOL.*?)(\d+\.\d+\s*Gal)', text, re.IGNORECASE).group(1).strip() if re.search(r'(DIESEL\s+B5.*?|GASOHOL.*?)(\d+\.\d+\s*Gal)', text, re.IGNORECASE) else None)
