import posthog from 'posthog-js'
import type { AnalyticsEvent } from './events'

type EventProperties<Name extends AnalyticsEvent['name']> = Extract<AnalyticsEvent, { name: Name }>['properties']

// TypeScript só faz excess-property-check nativo quando um objeto literal é
// atribuído direto ao parâmetro — se o valor passar por uma variável antes
// (mesmo `as const`), a checagem nativa não pega nenhuma chave a mais. `Exact`
// compara chave a chave meta o que a shape de verdade tem: sobrando qualquer
// chave, `Exclude<keyof T, keyof Shape>` deixa de ser `never`, e a expressão
// inteira vira `never` — o parâmetro da chamada fica impossível de satisfazer,
// erro de compilação garantido, não só no caso de literal direto.
// `T` de propósito sem `extends Shape` no parâmetro — a checagem de extensão
// vira parte do corpo condicional (`T extends Shape ? ... : never`) em vez de
// uma constraint estática, porque `Shape` aqui pode ser `EventProperties<Name>`
// com `Name` ainda genérico (não resolvido) no ponto de declaração do overload
// de `track` abaixo — como constraint estática, o TS tenta provar a relação
// distribuindo sobre toda a união de nomes de evento e falha; como conditional
// type avaliado por instanciação, funciona normalmente em cada call site real.
type Exact<Shape, T> = T extends Shape ? (Exclude<keyof T, keyof Shape> extends never ? T : never) : never

// Assinatura pública (o overload de cima) é a única que os call sites veem —
// é ela que carrega a checagem `Exact`. A implementação abaixo não consegue
// checar `Props extends EventProperties<Name>` com `Name` ainda genérico
// dentro do próprio corpo da função (limitação conhecida do TS com tipos
// condicionais correlacionados) — por isso a assinatura de implementação é
// deliberadamente frouxa, e só ela roda de verdade. Nenhum call site externo
// enxerga essa assinatura solta.
export function track<Name extends AnalyticsEvent['name'], Props>(
  name: Name,
  properties: Exact<EventProperties<Name>, Props>,
): void
export function track(name: AnalyticsEvent['name'], properties: Record<string, unknown>): void {
  posthog.capture(name, properties)
}
