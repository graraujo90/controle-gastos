import {
  Baby, Banknote, Beer, Bike, Bitcoin, BookOpen, Briefcase, Building2, Bus, Car, Coffee, Coins, CreditCard, Dog,
  DollarSign, Droplets, Dumbbell, Ellipsis, Film, Flame, Fuel, Gamepad2, Gift, GraduationCap, Hammer, HandCoins,
  HeartPulse, House, Landmark, Laptop, Music, PartyPopper, PiggyBank, Pill, Pizza, Plane, Receipt, Scissors, Shield,
  Shirt, ShoppingCart, Smartphone, Sofa, Sparkles, Stethoscope, Tag, Tv, TrendingUp, Umbrella, Utensils, Wallet,
  Wifi, Wrench, Zap, type LucideIcon,
} from 'lucide-react'
import { PALETTE } from '../db/seed'
import type { Category, TxType } from '../db/types'

/** Ícones que uma categoria pode usar. A chave é o que fica gravado no cadastro. */
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  casa: House, predio: Building2, sofa: Sofa, energia: Zap, agua: Droplets, gas: Flame, internet: Wifi, tv: Tv,
  mercado: ShoppingCart, refeicao: Utensils, pizza: Pizza, cafe: Coffee, bar: Beer,
  carro: Car, combustivel: Fuel, onibus: Bus, bicicleta: Bike, aviao: Plane, ferramenta: Wrench, obra: Hammer,
  saude: HeartPulse, remedio: Pill, consulta: Stethoscope, academia: Dumbbell, beleza: Scissors,
  estudo: GraduationCap, livro: BookOpen, notebook: Laptop, celular: Smartphone,
  jogo: Gamepad2, cinema: Film, musica: Music, festa: PartyPopper, presente: Gift,
  roupa: Shirt, bebe: Baby, pet: Dog, seguro: Shield, guardachuva: Umbrella,
  trabalho: Briefcase, dinheiro: Banknote, moedas: Coins, renda: HandCoins, carteira: Wallet, cartao: CreditCard,
  recibo: Receipt, banco: Landmark, cofre: PiggyBank, investimento: TrendingUp, dolar: DollarSign, cripto: Bitcoin,
  brilho: Sparkles, etiqueta: Tag, outros: Ellipsis,
}

/** Cores oferecidas na edição: a paleta original mais tons mais fechados. */
export const CATEGORY_COLORS = [...PALETTE, '#0891b2', '#7c3aed', '#db2777', '#059669', '#d97706', '#475569']

// Ícone sugerido pelo nome, para categorias que ainda não tiveram um escolhido. A primeira palavra que casar vence.
const BY_NAME: [RegExp, string][] = [
  [/alug|morad|casa/, 'casa'], [/condom/, 'predio'], [/energia|luz/, 'energia'], [/agua/, 'agua'], [/gas\b/, 'gas'],
  [/internet|wifi/, 'internet'], [/mercado|feira/, 'mercado'], [/restaur|aliment|refei/, 'refeicao'],
  [/combust|gasolina/, 'combustivel'], [/manuten|oficina/, 'ferramenta'], [/transp|carro|uber|app/, 'carro'],
  [/viag|ferias/, 'aviao'], [/saude|medic|plano/, 'saude'], [/farmac|remed/, 'remedio'], [/academ/, 'academia'],
  [/educa|escola|curso|facul/, 'estudo'], [/lazer|divers/, 'jogo'], [/vestu|roupa/, 'roupa'],
  [/assinat|stream/, 'tv'], [/celular|telefone/, 'celular'], [/pet|cachorro|gato/, 'pet'], [/presente/, 'presente'],
  [/seguro|previd/, 'seguro'], [/salario|pagamento/, 'dinheiro'], [/extra|freela/, 'renda'],
  [/reserva|emergenc|poupan/, 'cofre'], [/renda fixa|cdb|tesouro/, 'banco'], [/variavel|acoes|bolsa/, 'investimento'],
  [/cripto|bitcoin/, 'cripto'], [/dolar|exterior/, 'dolar'], [/receita/, 'moedas'], [/outr/, 'outros'],
]

const BY_TYPE: Record<TxType, string> = { receita: 'moedas', despesa: 'etiqueta', investimento: 'investimento' }

const plain = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Chave do ícone sugerido para um nome, ou undefined se nenhum combina. */
export const iconKeyByName = (name: string) => BY_NAME.find(([pattern]) => pattern.test(plain(name)))?.[1]

/**
 * Chave do ícone a mostrar: o escolhido na categoria; senão o da categoria-mãe (subcategoria herda);
 * senão um sugerido pelo nome; senão o padrão do tipo.
 */
export function iconKeyFor(category: Pick<Category, 'icon' | 'name' | 'type'>, parent?: Pick<Category, 'icon' | 'name'>) {
  const chosen = category.icon ?? parent?.icon
  if (chosen && CATEGORY_ICONS[chosen]) return chosen
  return iconKeyByName(category.name) ?? (parent && iconKeyByName(parent.name)) ?? BY_TYPE[category.type]
}
