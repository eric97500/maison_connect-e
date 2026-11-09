# 🏠 Maison connectée

Tableau de bord local qui regroupe tous les appareils de l'appartement sur le plan de chaque étage,
avec un **archivage de la puissance consommée par les prises Tapo**.

| Appareil | Connexion | Ce qui est possible |
|---|---|---|
| Prises Tapo (P110/P115) | local (python-kasa) | marche/arrêt, puissance en direct, **archive** |
| Ampoules Tapo | local | marche/arrêt, luminosité |
| Climatisation Tapo | prise Tapo à mesure | marche/arrêt, puissance, **archive** |
| Verisure | cloud (vsure) | état de l'alarme, armer / désarmer (code demandé à chaque fois, jamais stocké) |
| Wake on LAN | paquet magique | réveiller un PC, voir s'il est allumé |
| Caméras Avidsen | snapshot HTTP ou RTSP | image rafraîchie toutes les 3 s |
| NAS QNAP | API QTS | CPU, RAM, température, remplissage des volumes |
| NAS TerraMaster | réseau | en ligne / interface web joignable, Wake on LAN |
| Proxmox | API (jeton) | état des nœuds, démarrer / arrêter les VM et conteneurs |
| Imprimante Elegoo | SDCP ou Moonraker | progression, températures, pause / reprise / arrêt |
| Téléphone (présence) | ping Wi-Fi | à la maison / absent (déclencheur d'automatisations) |

## Mise en service (comme Home Assistant)

Sur l'accueil, la carte **Mise en service** liste les étapes et se coche toute seule :
comptes tado° / Tapo / Verisure, recherche réseau, ville, notifications, mot de passe, démarrage automatique,
puis **mode réel** (interrupteur dans Paramètres → Système, sans toucher aux fichiers).

- **Recherche réseau** (Paramètres) : trouve NAS QNAP / TerraMaster (reconnus aussi par leur adresse MAC),
  Proxmox, imprimante Elegoo, caméras et PC. « Remplace … » met à jour un appareil existant en gardant
  sa place sur le plan et ses automatisations.
- **Fonctionnement 24 h/24** :
  - *Sur ce PC Windows* : Paramètres → Système → « Démarrage automatique » (tâche planifiée à l'ouverture de
    session, sans fenêtre). `run.py` relance l'application si elle s'arrête.
  - *Sur ton Proxmox (recommandé, comme Home Assistant)* : crée un conteneur LXC Debian 12, copie le dossier
    dans `/opt/maison`, puis `sudo bash /opt/maison/deploy/install_linux.sh` → service systemd au démarrage.
  - *Docker* : `docker compose up -d` (réseau de l'hôte, nécessaire pour la recherche et le Wake on LAN).
- **Sauvegardes** : automatiques chaque nuit en mode réel (7 gardées dans `data/backups`), téléchargement
  et restauration dans Paramètres → Système. Garde aussi une copie de `.env` (mots de passe, non inclus).
- **Journal technique** : Paramètres → Système (fichiers dans `data/logs`).

## Serveurs (statistiques complètes)

Menu **Serveurs** : pour chaque NAS / Proxmox / serveur Linux → processeur, mémoire, swap, charge, températures,
ventilateurs, volumes, RAID (avec reconstruction en cours), disques (modèle, taille, température, santé SMART),
réseau ↓/↑, durée de fonctionnement, et courbes 6 h → 30 j (un point toutes les 5 min, gardé 1 an).

- **TerraMaster** : TOS n'a pas d'API → lecture **en SSH** (port 9222 par défaut sur TOS), en lecture seule.
  Identifiant = compte administrateur TOS, à saisir dans Paramètres → Comptes connectés.
  La santé SMART des disques n'apparaît que si le compte a le droit de lancer `smartctl`.
- **QNAP** : API QTS (volumes, disques SMART, températures, débit réseau).
- **Proxmox** : API (nœud, stockages, disques et usure des SSD, réseau, VM).
- **Serveur Linux** (type `linux`, ex. un serveur Docker) : même lecture SSH que le TerraMaster.

## Comptes connectés (Paramètres)

- **tado°** : bouton « Se connecter à tado° » → la page officielle de tado s'ouvre, tu te connectes, c'est fini.
  Aucun mot de passe n'est saisi dans l'application (connexion OAuth ; jeton dans `data/tado_token.json`).
  Puis « Rechercher mes pièces » → ajout en un clic (chauffage, clim Smart AC Control, eau chaude).
  tado limite le nombre d'appels par jour : actualisation toutes les 15 min par défaut (réglable).
- **Tapo** : e-mail + mot de passe de l'appli Tapo (écrits dans `.env`), puis « Rechercher mes appareils »
  trouve les prises et ampoules sur le Wi-Fi et les ajoute en un clic. Dans l'appli Tapo, active
  *Moi → Services tiers → Compatibilité tiers*, sinon les appareils refusent la connexion locale.
- **Verisure** : e-mail + mot de passe ; si Verisure envoie un code par SMS / e-mail, saisis-le dans la même carte.

## Fonctions « à la Home Assistant »

- **Automatisations** (menu Automatisations) : *Quand… / Seulement si… / Alors…*, créées à la souris.
  - Déclencheurs : heure (avec jours), lever/coucher du soleil (± minutes), un appareil s'allume / s'éteint /
    se déconnecte, consommation d'une prise au-dessus / en dessous d'un seuil pendant X minutes, alarme, présence.
  - Conditions : plage horaire, jours, état d'un appareil, alarme, présence, jour / nuit.
  - Actions : piloter un appareil, lancer une scène, envoyer une notification, attendre.
  - Enregistrées dans `data/automations.json`. Quelques exemples sont fournis (désactivés sauf « Impression 3D terminée »).
- **Scènes** : plusieurs actions d'un clic (Soirée TV, Tout éteindre, Bonne nuit, Travail), aussi en raccourci
  en haut du tableau de bord. Fichier `data/scenes.json`.
- **Journal** : tout ce qui se passe (allumages, actions, automatisations, notifications), filtrable, gardé 1 an.
  L'historique de chaque appareil est aussi visible dans sa fiche.
- **Notifications** : cloche dans l'interface + envoi sur le téléphone via **ntfy** (gratuit, appli « ntfy »)
  ou **Telegram** — à régler dans Paramètres, avec un bouton de test.
- **Météo** et heures de lever/coucher du soleil (Open-Meteo, gratuit) : choisis ta ville dans Paramètres.
- **Gestion des appareils** dans Paramètres : ajouter / modifier / supprimer sans toucher aux fichiers.
  ⚠️ Dès la première modification depuis l'interface, la liste est enregistrée dans `data/devices.json`
  qui remplace alors la section `devices:` de `config.yaml`.
- **Appli sur le téléphone** : ouvre le tableau de bord sur le téléphone puis « Ajouter à l'écran d'accueil ».

## Démarrage

1. Double-clic sur **`start.bat`** (la 1ʳᵉ fois il installe tout, ~1 min).
2. Ouvre **http://localhost:8123** (ou `http://IP-du-PC:8123` depuis le téléphone).

Au départ `demo: true` dans `config.yaml` : tout est simulé (avec 30 jours d'historique fictif)
pour découvrir l'interface. Les données de démo sont dans une base séparée (`archive_demo.db`).

## Passer en vrai

1. Copie `.env.example` en `.env` (déjà fait par start.bat) et remplis les identifiants.
   Mets aussi `DASHBOARD_PASSWORD` si l'interface est accessible depuis d'autres appareils.
2. Dans `config.yaml`, corrige l'**IP de chaque appareil** (visible dans ta box ou l'app Tapo — idéalement
   réserve des IP fixes dans la box) et passe `demo: false`.
3. Relance `start.bat`.

### Notes par appareil
- **Tapo** : il faut le compte TP-Link de l'app Tapo. Seules les prises **P110 / P115** mesurent la puissance
  (la P100 sait seulement allumer/éteindre).
- **Climatisation** : configurée comme une prise Tapo à mesure branchée sur la clim. Si ta clim est pilotée
  autrement (télécommande IR Tapo…), dis-le-moi pour adapter.
- **Verisure** : si le compte a la double authentification, lance une seule fois
  `.venv\Scripts\python -m app.verisure_mfa` pour enregistrer un cookie de confiance.
  L'état est lu au maximum toutes les 5 min (Verisure bloque les comptes trop sollicités).
  ⚠️ En France certaines installations passent par l'API *Securitas Direct* au lieu de Verisure :
  si la connexion échoue avec tes identifiants corrects, c'est probablement ton cas — dis-le-moi.
- **Caméras Avidsen** : renseigne `rtsp_url` (il faut installer [ffmpeg](https://www.gyan.dev/ffmpeg/builds/) et
  l'ajouter au PATH) ou `snapshot_url`. Les modèles « Avidsen Home » 100 % cloud (Tuya) n'ont pas toujours de flux local.
- **QNAP** : un compte (idéalement en lecture seule) ; `port: 8080` par défaut, `https: true` si besoin.
- **TerraMaster** : pas d'API publique, on surveille la présence réseau. Ajoute `mac:` pour pouvoir le réveiller.
- **Proxmox** : crée un jeton API (Datacenter → Permissions → API Tokens) avec le rôle `PVEVMUser` ou plus.
- **Elegoo** : `protocol: sdcp` pour Centauri Carbon / Saturn / Mars, `protocol: moonraker` pour Neptune 4.

## Archive de puissance

- Une mesure par prise toutes les `archive.interval_seconds` (60 s) dans `data/archive.db` (SQLite).
- Mesures détaillées gardées `raw_retention_days` (365 j), **totaux journaliers gardés pour toujours**.
- Onglet **Énergie** : courbes 6 h → 1 an, kWh par jour, coût estimé (`price_per_kwh`), export **CSV** (ouvrable dans Excel).
- L'archive ne se remplit que tant que le serveur tourne : pour un historique continu, laisse-le tourner
  sur une machine allumée en permanence (une VM/LXC Proxmox ou le NAS sont parfaits).

## Plan des étages

- `data/floors.json` : pièces, meubles et fenêtres de chaque étage (coordonnées en pixels).
  Pour l'étage 2, ajoute un bloc dans `floors` avec `"id": "etage2"` puis mets `floor: etage2` aux appareils.
- On peut aussi utiliser une image comme fond : `"background": "plans/etage2.png"` (fichier dans `web/plans/`).
- Coche **« Déplacer les appareils »** sur le plan pour glisser les icônes ; positions enregistrées dans `data/layout.json`.

## Ajouter un appareil
Ajoute une ligne dans `devices:` de `config.yaml` (id unique, `type` parmi : `tapo_plug`, `tapo_bulb`,
`tapo_clim`, `verisure`, `wol`, `camera`, `qnap`, `terramaster`, `proxmox`, `elegoo`) et relance.
