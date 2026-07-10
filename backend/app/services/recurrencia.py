"""
Genera automáticamente el Pago (adeudo) del mes en curso para los contratos
marcados con cobro_recurrente = True, una vez que se alcanza el "día de cobro"
configurado en el contrato. Es idempotente: si el pago del mes/año ya existe,
no se vuelve a crear.

No se usa un scheduler (cron/celery) para no añadir infraestructura nueva:
esta función se invoca "al vuelo" cada vez que se consultan los pagos o los
adeudos (GET /pagos, GET /pagos/mis-adeudos), así que basta con que alguien
abra la sección de Pagos o Adeudos para que la recurrencia del mes se genere.
"""
from datetime import date
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import Contrato, Pago, ConceptoPago


async def generar_pagos_recurrentes(db: AsyncSession) -> list[Pago]:
    hoy = date.today()

    r = await db.execute(
        select(Contrato).where(Contrato.status == "activo", Contrato.cobro_recurrente == True)
    )
    contratos = r.scalars().all()

    generados: list[Pago] = []
    for c in contratos:
        dia_cobro = min(max(c.dia_cobro or 1, 1), 28)
        if hoy.day < dia_cobro:
            continue  # todavía no llega el día de cobro marcado para este mes

        ya_existe = await db.execute(
            select(Pago).where(
                Pago.contrato_id == c.id,
                Pago.mes == hoy.month,
                Pago.anio == hoy.year,
            )
        )
        if ya_existe.scalar_one_or_none():
            continue  # el adeudo de este mes ya fue generado

        p = Pago(
            contrato_id=c.id, mes=hoy.month, anio=hoy.year,
            total=c.monto_mensual, tipo="recurrente", status="pendiente",
        )
        db.add(p)
        await db.flush()
        db.add(ConceptoPago(
            pago_id=p.id, tipo="renta", monto=c.monto_mensual,
            descripcion=f"Renta mensual recurrente (día {dia_cobro})",
        ))
        generados.append(p)

    if generados:
        await db.commit()
        for p in generados:
            await db.refresh(p, ["conceptos"])

    return generados
