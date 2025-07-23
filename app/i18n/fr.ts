const fr = {
  welcomeScreen: {
    postscript: "Ce n'est probablement pas à quoi ressemble votre application. (Sauf si votre designer vous a remis ces écrans, dans ce cas, lancez-la !)",
    readyForLaunch: "Votre application, presque prête pour le lancement !",
    exciting: "(oh, c'est excitant !)",
  },
  emptyStateComponent: {
    generic: {
      heading: "Si vide... si triste",
      content: "Aucune donnée trouvée pour le moment. Essayez de cliquer sur le bouton pour actualiser ou recharger l'application.",
      button: "Essayons à nouveau",
    },
  },
  patientView: {
    newVisit: "Nouvelle Visite",
  },
  newVisit: {
    newVisit: "Nouvelle Visite",
    completeVisit: "Terminer la Visite",
  },
  newPatient: {
    newPatient: "Nouveau Patient",
    updatePatient: "Mettre à jour le Patient",
    continueToVisits: "Continuer vers les Visites",
    invalidPatientId: "Tentative d'ouverture d'un dossier patient avec un identifiant invalide",
    similarFoundPatients: "Patients Existants Similaires",
    govtIdExists: "Identifiant gouvernemental déjà enregistré",
    errorSaving: "Une erreur s'est produite lors de l'enregistrement du dossier patient",
    successfulSave: "Dossier patient enregistré avec succès",
    done: "Terminé",
  },
  summaryStats: {
    summaryStats: "Statistiques Résumées",
    ageSexBreakdown: "Répartition par Âge et Sexe",
  },
}

export default fr
export type Translations = typeof fr
