import { Injectable } from '@nestjs/common';
import type { AdviceResponseDto } from '@finza/shared-types';
import { GeminiService } from './gemini.service';
import { FinancialContextService, type FinancialContext } from './financial-context.service';
import { AskAdviceDto } from './dto/ask-advice.dto';
import { AiNotConfiguredError } from './ai.errors';

const LANGUAGE_NAMES: Record<string, string> = { fr: 'français', en: 'anglais' };

@Injectable()
export class AiService {
  constructor(
    private readonly gemini: GeminiService,
    private readonly contextBuilder: FinancialContextService,
  ) {}

  async getAdvice(userId: string, dto: AskAdviceDto): Promise<AdviceResponseDto> {
    this.assertConfigured();
    const context = await this.contextBuilder.build(userId);
    const systemInstruction = this.buildSystemInstruction(context);
    const message = `${this.buildContextBlock(context)}\n\nQuestion de l'utilisateur : ${dto.message}`;
    const reply = await this.gemini.generateReply(systemInstruction, dto.history ?? [], message);
    return { reply };
  }

  // Résumé proactif (section 7 du cahier des charges) : le prompt est construit
  // automatiquement, l'utilisateur n'a rien à taper — mais la réponse reste une vraie
  // génération Gemini, jamais un gabarit rempli localement.
  async getMonthlySummary(userId: string): Promise<AdviceResponseDto> {
    this.assertConfigured();
    const context = await this.contextBuilder.build(userId);
    const systemInstruction = this.buildSystemInstruction(context);
    const message =
      `${this.buildContextBlock(context)}\n\n` +
      "Génère un résumé de ma situation financière de ce mois-ci : ce que j'ai gagné, dépensé et épargné, " +
      'une brève analyse, et un conseil concret adapté à mes données.';
    const reply = await this.gemini.generateReply(systemInstruction, [], message);
    return { reply };
  }

  private assertConfigured(): void {
    if (!this.gemini.isConfigured()) {
      throw new AiNotConfiguredError();
    }
  }

  private buildSystemInstruction(context: FinancialContext): string {
    const languageName = LANGUAGE_NAMES[context.profile.preferredLanguage] ?? 'français';

    return [
      "Tu es l'assistant financier intégré à Finza, une application de gestion des revenus et finances personnelles pour l'Afrique francophone.",
      `Réponds toujours en ${languageName}.`,
      '',
      'PERSONNALITÉ : claire, pédagogique, concise, encourageante, objective, jamais culpabilisante. Parle comme un ' +
        "conseiller qui aide l'utilisateur à mieux comprendre ses finances, pas comme un expert technique. Évite le " +
        'jargon financier. Évite les réponses génériques : base-toi sur les données réelles fournies ci-dessous, ' +
        'jamais sur des généralités qui pourraient s\'appliquer à n\'importe qui.',
      '',
      'STRUCTURE : pour une analyse ou un résumé, structure ta réponse avec ces sections courtes quand elles ' +
        'apportent quelque chose (saute celles qui ne servent à rien pour la question posée) : Analyse, Ce que vous ' +
        'faites bien, Points à surveiller, Conseil, Action recommandée. Pour une question simple ou un échange de ' +
        'suivi, une réponse directe et courte suffit — pas besoin de forcer cette structure. Reste concis dans tous ' +
        'les cas : jamais de réponse exagérément longue.',
      '',
      "PAYS ET DEVISE : le pays et la devise de l'utilisateur sont fournis ci-dessous s'ils sont connus. Utilise-les " +
        "pour contextualiser tes conseils, mais n'invente JAMAIS un prix, un coût de la vie local ou une donnée que " +
        "tu ne connais pas avec certitude. Base tes conseils en priorité sur les chiffres réels que l'utilisateur a " +
        "saisis dans l'application. Si une information locale te manque, dis-le clairement au lieu de l'inventer.",
      '',
      'LIMITES : tu fournis des conseils généraux de gestion financière, pas des conseils financiers professionnels ' +
        "personnalisés. Ne promets jamais de gains, ne garantis jamais un résultat financier, n'invente jamais de " +
        "chiffres, et ne prétends jamais connaître la situation financière complète de l'utilisateur si des données " +
        'manquent. Si les données disponibles sont insuffisantes pour une analyse fiable (par exemple aucun revenu ' +
        'ni dépense enregistré), dis-le clairement — quelque chose comme : "Je n\'ai pas assez de données pour ' +
        'donner une analyse fiable. Ajoutez quelques revenus ou dépenses pour que je puisse mieux vous aider." ' +
        'plutôt que de deviner.',
      '',
      "SÉCURITÉ : l'application ne se connecte à aucun compte bancaire ni service Mobile Money (Orange Money, MTN " +
        'Mobile Money, Moov Money, etc.) — tout ce que tu vois vient de ce que la personne a saisi elle-même. Ne lui ' +
        'demande jamais de mot de passe, code PIN ou identifiant.',
    ].join('\n');
  }

  private buildContextBlock(context: FinancialContext): string {
    const { profile } = context;
    const lines: string[] = [
      '--- Données financières de l\'utilisateur ---',
      `Nom : ${profile.fullName}`,
      `Pays : ${profile.countryLabel ?? 'non renseigné'}`,
      `Devise : ${profile.currencyLabel}`,
      `Objectif financier principal (déclaré par l'utilisateur) : ${profile.mainFinancialGoal ?? 'non renseigné'}`,
      `Fréquence de revenus habituelle : ${profile.incomeFrequencyLabel ?? 'non renseignée'}`,
      `Situation financière déclarée : ${profile.financialSituationLabel ?? 'non renseignée'}`,
      '',
    ];

    if (!context.hasAnyData) {
      lines.push("Aucune source de revenus n'a encore été créée dans l'application : aucune donnée financière disponible.");
      return lines.join('\n');
    }

    lines.push(
      `Période analysée : ${context.period}`,
      `Revenus : ${context.totalIncome} ${profile.currencyLabel}`,
      `Dépenses : ${context.totalExpense} ${profile.currencyLabel}`,
      `Solde net : ${context.netFlow} ${profile.currencyLabel}`,
      `Épargné ce mois-ci : ${context.totalSavingsThisMonth} ${profile.currencyLabel}`,
      `Revenus du mois précédent : ${context.previousMonthIncome} ${profile.currencyLabel}`,
      `Dépenses du mois précédent : ${context.previousMonthExpense} ${profile.currencyLabel}`,
    );

    if (context.topExpenseCategories.length > 0) {
      lines.push('', 'Principales catégories de dépenses ce mois-ci :');
      for (const c of context.topExpenseCategories) {
        lines.push(`- ${c.label} : ${c.amount} ${profile.currencyLabel}`);
      }
    }

    if (context.goals.length > 0) {
      lines.push('', "Objectifs d'épargne :");
      for (const g of context.goals) {
        lines.push(`- ${g.name} : ${g.currentAmount} / ${g.targetAmount} ${profile.currencyLabel} (${g.percentage}%)`);
      }
    }

    if (context.debts.length > 0) {
      lines.push('', 'Dettes et créances en cours :');
      for (const d of context.debts) {
        lines.push(
          `- ${d.counterpartyName} (${d.direction === 'debt' ? 'je dois' : 'on me doit'}) : ${d.remaining} ${profile.currencyLabel} restant`,
        );
      }
    }

    if (context.activeSubscriptionsCount > 0) {
      lines.push(
        '',
        `Abonnements actifs : ${context.activeSubscriptionsCount}, pour ${context.totalMonthlySubscriptions} ${profile.currencyLabel}/mois au total.`,
      );
    }

    return lines.join('\n');
  }
}
