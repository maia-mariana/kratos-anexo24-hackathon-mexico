/**
 * Fictional seed data for KRATOS-Anexo24 engine.
 * DATOS FICTICIOS — SOLO DEMO
 * Matches KRATOS static app seed (2 empresas, 9 materiales, 17 lotes, 17 pedimentos).
 */

export const seedData = {
  companies: [
    {
      id: 'mb',
      rfc: 'MBA090312KQ4',
      name: 'PolyTech Moldeo Industrial S.A. de C.V.',
      corto: 'PolyTech',
      planta: 'Planta 1',
      perfil: 'inyeccion',
      prevRisk: 4200000
    },
    {
      id: 'an',
      rfc: 'ANO150817TZ1',
      name: 'Arneses y Conectores del Norte S.A. de C.V.',
      corto: 'Arneses Norte',
      planta: 'Planta 2',
      perfil: 'ensamble',
      prevRisk: 1800000
    }
  ],

  materiales: [
    { id: 'MAT-001', companyId: 'mb', nombre: 'Resina PP', corto: 'PP', fraccion: '3902.10.01', um: 'kg', igiRate: 0.05, consumoMes: 25000, plan: 30000, vu: 18.50, keys: ['PP'] },
    { id: 'MAT-002', companyId: 'mb', nombre: 'Masterbatch Negro', corto: 'MBK', fraccion: '3204.17.01', um: 'kg', igiRate: 0.07, consumoMes: 1200, plan: 1500, vu: 45.00, keys: ['MBK'] },
    { id: 'MAT-003', companyId: 'mb', nombre: 'Aditivo UV', corto: 'UV', fraccion: '3812.30.01', um: 'kg', igiRate: 0.05, consumoMes: 800, plan: 1000, vu: 120.00, keys: ['UV'] },
    { id: 'MAT-004', companyId: 'mb', nombre: 'Polietileno HDPE', corto: 'HDPE', fraccion: '3901.20.01', um: 'kg', igiRate: 0.05, consumoMes: 15000, plan: 18000, vu: 22.00, keys: ['HDPE'] },
    { id: 'MAT-005', companyId: 'mb', nombre: 'Colorante Blanco', corto: 'CB', fraccion: '3206.11.01', um: 'kg', igiRate: 0.07, consumoMes: 500, plan: 600, vu: 85.00, keys: ['CB'] },
    { id: 'MAT-006', companyId: 'an', nombre: 'Cobre Calibre 18', corto: 'CU18', fraccion: '7408.11.01', um: 'kg', igiRate: 0.05, consumoMes: 5000, plan: 6000, vu: 180.00, keys: ['CU18'] },
    { id: 'MAT-007', companyId: 'an', nombre: 'PVC Aislamiento', corto: 'PVC', fraccion: '3904.10.01', um: 'kg', igiRate: 0.05, consumoMes: 3000, plan: 3500, vu: 35.00, keys: ['PVC'] },
    { id: 'MAT-008', companyId: 'an', nombre: 'Conector RJ45', corto: 'RJ45', fraccion: '8536.69.01', um: 'pza', igiRate: 0.07, consumoMes: 20000, plan: 25000, vu: 2.50, keys: ['RJ45'] },
    { id: 'MAT-009', companyId: 'an', nombre: 'Terminal Ring', corto: 'TR', fraccion: '8536.90.99', um: 'pza', igiRate: 0.07, consumoMes: 15000, plan: 18000, vu: 1.80, keys: ['TR'] }
  ],

  pedimentos: [
    { id: 'PED-001', companyId: 'mb', numero: '25 47 3711 5001987', clave: 'IN', aduana: '47', patente: '3711', fechaPago: '2025-05-04', rfc: 'MBA090312KQ4' },
    { id: 'PED-002', companyId: 'mb', numero: '25 47 3711 5002604', clave: 'IN', aduana: '47', patente: '3711', fechaPago: '2025-06-12', rfc: 'MBA090312KQ4' },
    { id: 'PED-003', companyId: 'mb', numero: '25 47 3711 5003112', clave: 'IN', aduana: '47', patente: '3711', fechaPago: '2025-07-20', rfc: 'MBA090312KQ4' },
    { id: 'PED-004', companyId: 'mb', numero: '25 47 3711 5003845', clave: 'IN', aduana: '47', patente: '3711', fechaPago: '2025-08-08', rfc: 'MBA090312KQ4' },
    { id: 'PED-005', companyId: 'mb', numero: '25 47 3711 5004210', clave: 'IN', aduana: '47', patente: '3711', fechaPago: '2025-09-15', rfc: 'MBA090312KQ4' },
    { id: 'PED-006', companyId: 'mb', numero: '25 47 3711 5004921', clave: 'IN', aduana: '47', patente: '3711', fechaPago: '2025-10-01', rfc: 'MBA090312KQ4' },
    { id: 'PED-007', companyId: 'mb', numero: '25 47 3711 5005433', clave: 'IN', aduana: '47', patente: '3711', fechaPago: '2025-11-10', rfc: 'MBA090312KQ4' },
    { id: 'PED-008', companyId: 'an', numero: '25 38 2901 4001123', clave: 'IN', aduana: '38', patente: '2901', fechaPago: '2025-04-20', rfc: 'ANO150817TZ1' },
    { id: 'PED-009', companyId: 'an', numero: '25 38 2901 4002456', clave: 'IN', aduana: '38', patente: '2901', fechaPago: '2025-05-28', rfc: 'ANO150817TZ1' },
    { id: 'PED-010', companyId: 'an', numero: '25 38 2901 4003789', clave: 'IN', aduana: '38', patente: '2901', fechaPago: '2025-07-05', rfc: 'ANO150817TZ1' },
    { id: 'PED-011', companyId: 'an', numero: '25 38 2901 4004321', clave: 'IN', aduana: '38', patente: '2901', fechaPago: '2025-08-18', rfc: 'ANO150817TZ1' },
    { id: 'PED-012', companyId: 'an', numero: '25 38 2901 4005678', clave: 'IN', aduana: '38', patente: '2901', fechaPago: '2025-09-30', rfc: 'ANO150817TZ1' },
    { id: 'PED-013', companyId: 'an', numero: '25 38 2901 4006112', clave: 'IN', aduana: '38', patente: '2901', fechaPago: '2025-11-03', rfc: 'ANO150817TZ1' },
    { id: 'PED-014', companyId: 'an', numero: '25 38 2901 4007004', clave: 'IN', aduana: '38', patente: '2901', fechaPago: '2025-12-14', rfc: 'ANO150817TZ1' },
    { id: 'PED-015', companyId: 'mb', numero: '25 47 3711 5007890', clave: 'V1', aduana: '47', patente: '3711', fechaPago: '2025-03-15', rfc: 'MBA090312KQ4' },
    { id: 'PED-016', companyId: 'mb', numero: '25 47 3711 5008445', clave: 'AF', aduana: '47', patente: '3711', fechaPago: '2025-02-28', rfc: 'MBA090312KQ4' },
    { id: 'PED-017', companyId: 'an', numero: '25 38 2901 4008999', clave: 'RT', aduana: '38', patente: '2901', fechaPago: '2025-06-01', rfc: 'ANO150817TZ1' }
  ],

  partidas: [
    { id: 'PAR-001', pedimentoId: 'PED-001', materialId: 'MAT-001', cantidadInicial: 25000, valorUnitarioMXN: 1850, igiRate: 0.05, plazoMeses: 18 },
    { id: 'PAR-002', pedimentoId: 'PED-002', materialId: 'MAT-001', cantidadInicial: 20000, valorUnitarioMXN: 1850, igiRate: 0.05, plazoMeses: 18 },
    { id: 'PAR-003', pedimentoId: 'PED-003', materialId: 'MAT-002', cantidadInicial: 15000, valorUnitarioMXN: 4500, igiRate: 0.07, plazoMeses: 18 },
    { id: 'PAR-004', pedimentoId: 'PED-004', materialId: 'MAT-003', cantidadInicial: 8000, valorUnitarioMXN: 12000, igiRate: 0.05, plazoMeses: 18 },
    { id: 'PAR-005', pedimentoId: 'PED-005', materialId: 'MAT-004', cantidadInicial: 30000, valorUnitarioMXN: 2200, igiRate: 0.05, plazoMeses: 18 },
    { id: 'PAR-006', pedimentoId: 'PED-006', materialId: 'MAT-005', cantidadInicial: 5000, valorUnitarioMXN: 8500, igiRate: 0.07, plazoMeses: 18 },
    { id: 'PAR-007', pedimentoId: 'PED-007', materialId: 'MAT-001', cantidadInicial: 22000, valorUnitarioMXN: 1850, igiRate: 0.05, plazoMeses: 18 },
    { id: 'PAR-008', pedimentoId: 'PED-008', materialId: 'MAT-006', cantidadInicial: 10000, valorUnitarioMXN: 18000, igiRate: 0.05, plazoMeses: 18 },
    { id: 'PAR-009', pedimentoId: 'PED-009', materialId: 'MAT-007', cantidadInicial: 8000, valorUnitarioMXN: 3500, igiRate: 0.05, plazoMeses: 18 },
    { id: 'PAR-010', pedimentoId: 'PED-010', materialId: 'MAT-008', cantidadInicial: 50000, valorUnitarioMXN: 250, igiRate: 0.07, plazoMeses: 18 },
    { id: 'PAR-011', pedimentoId: 'PED-011', materialId: 'MAT-009', cantidadInicial: 30000, valorUnitarioMXN: 180, igiRate: 0.07, plazoMeses: 18 },
    { id: 'PAR-012', pedimentoId: 'PED-012', materialId: 'MAT-006', cantidadInicial: 12000, valorUnitarioMXN: 18000, igiRate: 0.05, plazoMeses: 18 },
    { id: 'PAR-013', pedimentoId: 'PED-013', materialId: 'MAT-007', cantidadInicial: 10000, valorUnitarioMXN: 3500, igiRate: 0.05, plazoMeses: 18 },
    { id: 'PAR-014', pedimentoId: 'PED-014', materialId: 'MAT-008', cantidadInicial: 60000, valorUnitarioMXN: 250, igiRate: 0.07, plazoMeses: 18 },
    { id: 'PAR-015', pedimentoId: 'PED-015', materialId: 'MAT-001', cantidadInicial: 15000, valorUnitarioMXN: 1850, igiRate: 0.05, plazoMeses: 18 },
    { id: 'PAR-016', pedimentoId: 'PED-016', materialId: 'MAT-004', cantidadInicial: 20000, valorUnitarioMXN: 2200, igiRate: 0.05, plazoMeses: 18 },
    { id: 'PAR-017', pedimentoId: 'PED-017', materialId: 'MAT-006', cantidadInicial: 5000, valorUnitarioMXN: 18000, igiRate: 0.05, plazoMeses: 18 }
  ],

  boms: [
    { id: 'BOM-001', version: 'v1', productId: 'MAT-001', piezasPorLote: 1000, components: [{materialId: 'MAT-001', qtyPerPiece: 0.98}, {materialId: 'MAT-002', qtyPerPiece: 0.02}], mermaPct: 0.02, recicladoPct: 0.01 },
    { id: 'BOM-002', version: 'v1', productId: 'MAT-004', piezasPorLote: 500, components: [{materialId: 'MAT-004', qtyPerPiece: 0.99}, {materialId: 'MAT-003', qtyPerPiece: 0.01}], mermaPct: 0.015, recicladoPct: 0.005 },
    { id: 'BOM-003', version: 'v1', productId: 'MAT-006', piezasPorLote: 200, components: [{materialId: 'MAT-006', qtyPerPiece: 0.95}, {materialId: 'MAT-007', qtyPerPiece: 0.05}], mermaPct: 0.02, recicladoPct: 0.01 },
    { id: 'BOM-004', version: 'v1', productId: 'MAT-008', piezasPorLote: 100, components: [{materialId: 'MAT-008', qtyPerPiece: 0.97}, {materialId: 'MAT-009', qtyPerPiece: 0.03}], mermaPct: 0.01, recicladoPct: 0.005 },
    { id: 'BOM-005', version: 'v1', productId: 'MAT-001', piezasPorLote: 1000, components: [{materialId: 'MAT-001', qtyPerPiece: 0.97}, {materialId: 'MAT-002', qtyPerPiece: 0.03}], mermaPct: 0.025, recicladoPct: 0.01 }
  ],

  initialMovements: []
};

// Generate initial ENTRY movements from partidas
(function buildInitial() {
  const crypto = globalThis.crypto || require('crypto');
  const uuidv4 = () => crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });

  for (const p of seedData.partidas) {
    const ped = seedData.pedimentos.find(x => x.id === p.pedimentoId);
    const mat = seedData.materiales.find(x => x.id === p.materialId);
    seedData.initialMovements.push({
      id: uuidv4(),
      companyId: ped.companyId,
      kind: 'ENTRY',
      refs: {
        pedimentoId: p.pedimentoId,
        partidaId: p.id,
        materialId: p.materialId,
        lotId: `L-${p.id}`,
        fechaPago: ped.fechaPago
      },
      qtyBase: p.cantidadInicial,
      unit: mat.um,
      unitCostMXN: p.valorUnitarioMXN,
      timestamp: new Date(ped.fechaPago).toISOString(),
      actor: 'seed',
      reason: 'Carga inicial desde pedimento',
      idempotencyKey: `seed-${p.id}`,
      schemaVersion: 1
    });
  }
})();