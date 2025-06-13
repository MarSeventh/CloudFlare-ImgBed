<div align="center">
    <a href="https://github.com/MarSeventh/CloudFlare-ImgBed"><img width="80%" alt="logo" src="static/readme/banner.png"/></a>
    <p><em>🗂️Solution d'hébergement de fichiers open source, basé sur Cloudflare Pages, prenant en charge Telegram Bot, Cloudflare R2, S3 et d'autres canaux de stockage</em></p>
    <p>
        <a href="https://github.com/MarSeventh/CloudFlare-ImgBed/blob/main/README.md">简体中文</a>|<a href="https://github.com/MarSeventh/CloudFlare-ImgBed/blob/main/README_en.md">English</a>
    </p>
    <div>
        <a href="https://github.com/MarSeventh/CloudFlare-ImgBed/blob/main/LICENSE">
        <img src="https://img.shields.io/github/license/MarSeventh/CloudFlare-ImgBed" alt="License" />
        </a>
        <a href="https://github.com/MarSeventh/CloudFlare-ImgBed/releases">
        <img src="https://img.shields.io/github/release/MarSeventh/CloudFlare-ImgBed" alt="latest version" />
        </a>
        <a href="https://github.com/MarSeventh/CloudFlare-ImgBed/releases">
        <img src="https://img.shields.io/github/downloads/MarSeventh/CloudFlare-ImgBed/total?color=%239F7AEA&logo=github" alt="Downloads" />
        </a>
        <a href="https://hub.docker.com/r/marseventh/cloudflare-imgbed">
  		  <img src="https://img.shields.io/docker/pulls/marseventh/cloudflare-imgbed?style=flat-square" alt="Docker Pulls" />
		</a>
        <a href="https://github.com/MarSeventh/CloudFlare-ImgBed/issues">
          <img src="https://img.shields.io/github/issues/MarSeventh/CloudFlare-ImgBed" alt="Issues" />
        </a>
        <a href="https://github.com/MarSeventh/CloudFlare-ImgBed/stargazers">
          <img src="https://img.shields.io/github/stars/MarSeventh/CloudFlare-ImgBed" alt="Stars" />
        </a>
        <a href="https://github.com/MarSeventh/CloudFlare-ImgBed/network/members">
          <img src="https://img.shields.io/github/forks/MarSeventh/CloudFlare-ImgBed" alt="Forks" />
        </a>
    </div>
</div>



---

> [!IMPORTANT]
>
> **Veuillez consulter l'annonce pour les notes de mise à niveau de la version v2.0 !**

<details>
    <summary>Annonce</summary>



## Épinglé

1. Si vous rencontrez des problèmes lors du déploiement, veuillez d'abord consulter attentivement la documentation, les questions fréquentes et les problèmes existants.

2. **Dépôt frontal** : [MarSeventh/Sanyue-ImgHub](https://github.com/MarSeventh/Sanyue-ImgHub)

3. **Remarque** : Ce dépôt est une version remaniée du projet [Telegraph-Image](https://github.com/cf-pages/Telegraph-Image). Si vous trouvez ce projet utile, veuillez également soutenir le projet original.

## 2025.2.6 Notes de mise à niveau de la version V2.0

> La version bêta v2.0 a été publiée, avec de nombreux changements et optimisations par rapport à la version v1.0, mais la version bêta peut présenter une instabilité potentielle. Si vous recherchez la stabilité, vous pouvez choisir de retarder la mise à jour.
>
> En raison de **changements dans les commandes de construction**, cette mise à jour nécessite que vous **effectuiez manuellement** les opérations suivantes :
>
> - Synchronisez le dépôt fork vers la dernière version (si la synchronisation automatique a déjà eu lieu, vous pouvez ignorer cette étape)
>
> - Allez sur la page de gestion des pages, accédez à `Paramètres` -> `Construction`, éditez `Configuration de construction`, et dans `Commande de construction`, entrez `npm install`
>
>   ![image-20250212190315179](static/readme/202502121903327.png)
>
> - Tous les paramètres de la nouvelle version ont été **migrés vers l'interface de gestion -> Paramètres système**, en principe, il n'est plus nécessaire de les configurer via des variables d'environnement. Les paramètres effectués via l'interface de paramètres système **écraseront** les paramètres des variables d'environnement. Cependant, pour garantir que les **images des canaux Telegram** soient compatibles avec l'ancienne version, **si vous avez précédemment configuré des variables d'environnement liées aux canaux Telegram, veuillez les conserver !**
>
> - Une fois que vous avez vérifié que les paramètres ci-dessus sont corrects, allez sur la page de gestion des pages, accédez à `Déploiement`, et effectuez une `réessai` de la dernière tentative de déploiement qui a échoué.

## Notification concernant le passage au canal Telegram


> En raison de l'abus du service d'hébergement d'images Telegraph, le canal de téléchargement de ce projet a été changé en canal Telegram. Veuillez **mettre à jour vers la dernière version (voir la dernière section du chapitre 3.1 pour les méthodes de mise à jour)**, et configurer **`TG_BOT_TOKEN` et `TG_CHAT_ID`** selon les exigences de déploiement dans la documentation, sinon la fonction de téléchargement ne fonctionnera pas correctement.
>
> De plus, actuellement, **la base de données KV est obligatoire**. Si elle n'a pas été configurée auparavant, veuillez suivre les instructions de la documentation pour la configurer.
>
> En cas de problème, veuillez d'abord consulter la section Q&A des questions fréquentes au chapitre 5.

</details>

<details>
    <summary>Construction de l'écosystème</summary>



## 1. Plugins

- **Téléchargement automatique dans l'éditeur (script Tampermonkey)** : https://greasyfork.org/zh-CN/scripts/529816-image-uploader-to-markdown-to-cloudflare-imgbed （_Auteur : Linux.do : [calg_c](https://linux.do/u/calg_c/summary)_）

## 2. Dépôts

- **Envoyer des fichiers au canal TG pour l'hébergement d'images** : [uki0xc/img-up-bot : Utiliser le robot Telegram pour télécharger des images](https://github.com/uki0xc/img-up-bot?tab=readme-ov-file) （_Auteur : [uki0xc](https://github.com/uki0xc)_)



</details>

<details>
    <summary>Adresse d'expérience et articles de qualité, vidéos (si vous avez des problèmes de configuration ou d'utilisation, vous pouvez d'abord aller apprendre là-bas~)</summary>


**Adresse d'expérience** : [CloudFlare ImgBed](https://cfbed.1314883.xyz/)

> Code d'accès : cfbed

**Vidéo d'expérience** : [CloudFlare gratuit hébergement d'images, protégez facilement chaque moment !_哔哩哔哩_bilibili](https://www.bilibili.com/video/BV1y3WGe4EGh/?vd_source=da5ecbe595e41089cd1bed95932b8bfd)

**Vidéos de tutoriels connexes** :

- [Construire un système d'hébergement d'images en ligne avec Cloudflare R2 + Pages, sans limite d'espace, non bloqué, super simple, entièrement gratuit (youtube.com)](https://www.youtube.com/watch?v=T8VayuUMOzM)

**Articles de qualité connexes (merci à chaque personne qui soutient avec enthousiasme) :**

- [Projet CloudFlare-ImgBed – le petit coin de yunsen2025](https://www.yunsen2025.top/category/cloudflare-imgbed/)
  - [Entièrement gratuit, tutoriel étape par étape pour utiliser Cloudflare pour construire un hébergement d'images privé avec espace illimité, prenant en charge l'authentification et la vérification des éléments pour adultes ! - le petit coin de yunsen2025](https://www.yunsen2025.top/blog-cfpages-syq-imgbed)
  - [Configurer le CDN national pour CloudFlare-ImgBed et l'analyse par ligne, pour profiter de la vitesse ultime à moindre coût ! – le petit coin de yunsen2025](https://www.yunsen2025.top/cloudflare-imgbed-fen-xian-pei-zhi-guo-nei-cdn/)
- [Construire un hébergement d'images basé sur CloudFlare et Telegram (lepidus.me)](https://blogstr.lepidus.me/post/1725801323700/)
- [Tutoriel sur la construction d'un hébergement d'images gratuit basé sur CloudFlare et Telegram - Liu Xueguan | Blog (sexy0769.com)](https://blog.sexy0769.com/skill/735.html)
- [CloudFlare + Github, créez votre propre hébergement d'images gratuit - le petit blog de Dàtóudīng (luckyting.top)](https://luckyting.top/index.php/archives/20/)

</details>



## Dernières mises à jour

Ajouter des fonctionnalités :

- Embellir les images d'erreur
- La page de téléchargement prend en charge l'aperçu des fichiers de format ico et plus encore



<details>
    <summary>Journal des mises à jour</summary>


## 2025.6.13

Ajouter des fonctionnalités :

- Embellir les images d'erreur
- La page de téléchargement prend en charge l'aperçu des fichiers de format ico et plus encore

## 2025.6.12

Ajouter des fonctionnalités :

- L'interface `upload` prend en charge l'accès et l'appel inter-domaines

Corriger des bugs :

- Correction du problème d'intégrité des données retournées par l'interface `list`

## 2025.5.23

Ajouter des fonctionnalités :

- Ajout de la fonction d'annonce

Corriger des bugs :

- Correction du problème où les noms d'images dans le backend étaient trop longs et masquaient les images
- Optimisation de l'affichage de certaines pages
- Correction du problème d'accès aux liens externes https dans l'image Docker

## 2025.5.11

Ajouter des fonctionnalités :

- Prise en charge du déploiement sur le serveur via Docker

## 2025.3.14

Ajouter des fonctionnalités :

- La gestion des utilisateurs téléchargés prend en charge l'affichage de l'emplacement IP spécifique

## 2025.3.8

Ajouter des fonctionnalités :

- L'API d'images aléatoires prend en charge la lecture par répertoire, prend en charge le contrôle d'accès par répertoire

Corriger des bugs :

- Correction du problème de cache de l'API d'images aléatoires

## 2025.3.7

Ajouter des fonctionnalités :

- **La fonction de répertoire est en ligne**. Actuellement, elle prend en charge :
  - Téléchargement dans un répertoire spécifié
  - Suppression de tout le répertoire
  - Déplacement de fichiers (Telegraph et l'ancien canal Telegram ne prennent pas en charge le déplacement)
  - Lecture de fichiers par répertoire
- L'API d'images aléatoires prend en charge la lecture par répertoire

Corriger des bugs :

- Correction de plusieurs bugs affectant l'expérience

## 2025.3.1

Ajouter des fonctionnalités :

- Prise en charge du collage de plusieurs liens pour un téléchargement simultané
- Prise en charge du stockage et de la gestion des liens externes

Corriger des bugs :

- Correction des problèmes liés à la copie de liens S3 dans le backend
- Correction des problèmes où certains paramètres de page dans le backend ne prenaient pas effet
- Correction des problèmes où certains paramètres de canal ne pouvaient pas être enregistrés dans certaines situations

## 2025.2.6

**La version v2.0 fait son apparition**, apportant de nombreuses nouvelles fonctionnalités et optimisations, vous offrant une expérience utilisateur renouvelée :

💪**Plus puissant** :

- Intégration de l'API S3, prenant en charge les services de stockage d'objets de plusieurs fournisseurs tels que Cloudflare R2, Backblaze B2, Qiniu Cloud, Youpai Cloud, etc.
- Prise en charge de la configuration de plusieurs canaux Telegram et S3, prenant en charge l'équilibrage de charge multi-canaux
- Prise en charge de la méthode de nommage de fichiers courts pour les fichiers téléchargés

✈️**Plus efficace** :

- Tous les paramètres ont été migrés vers l'interface de paramètres système du backend, sans besoin de configuration fastidieuse des variables d'environnement, les paramètres prennent effet immédiatement
- Les pages de gestion telles que la galerie et la gestion des utilisateurs réalisent une lecture paginée, améliorant la vitesse de rendu frontend et optimisant l'expérience utilisateur
- Prise en charge de la désactivation et de l'activation des canaux, la gestion des canaux est sous contrôle
- Plusieurs paramètres ajoutent des fenêtres contextuelles d'alerte, pas besoin de fouiller dans la documentation, les paramètres sont plus fiables

✨**Plus raffiné** :

- Prise en charge globale du mode sombre, basculant automatiquement selon les préférences de l'utilisateur et l'heure, mettant en avant un sentiment de sophistication
- La page de connexion, la page de la galerie, la page de gestion des utilisateurs et d'autres pages ont été retravaillées pour des détails plus intuitifs
- Nouvelle barre d'onglets sur la page de téléchargement, facile à utiliser
- Logo renouvelé, fait à la main, capacités limitées, pas de critiques ( 
- Prise en charge de la personnalisation de la page de pied de page, les personnes perfectionnistes sont sauvées

## 2024.12.27

Ajouter des fonctionnalités :

- Prise en charge de la personnalisation du préfixe de lien par défaut global via des variables d'environnement (voir 3.1.3.6 interface de configuration personnalisée)
- Prise en charge de la personnalisation du préfixe de lien dans le backend
- Optimisation de l'affichage de certaines pages dans le backend
- L'API `/upload` prend en charge le retour de liens complets (définir le paramètre `returnFormat` lors de la demande, voir la documentation API)

Corriger des bugs :

- Optimisation de l'affichage de la page de téléchargement

## 2024.12.20

Ajouter des fonctionnalités :

- Prise en charge de la mise en liste noire des IP de téléchargement dans le backend (Dashboard -> Gestion des utilisateurs -> Autoriser le téléchargement)
- Prise en charge des opérations en masse dans le backend selon l'ordre choisi par l'utilisateur ([#issue124](https://github.com/MarSeventh/CloudFlare-ImgBed/issues/124))
- Optimisation de l'interface `random`, réduction du nombre d'opérations KV, ajout du paramètre `content`, prise en charge du retour de fichiers de type spécifié
- Intégration de l'API CloudFlare Cache, amélioration de la vitesse d'accès aux interfaces liées à la liste
- Le temps de cache CDN pour les images retournées est ajusté de 1 an à 7 jours, afin d'éviter que les images ne soient accessibles pendant une longue période en cas d'échec de la suppression du cache

## 2024.12.14

Ajouter des fonctionnalités :

- Ajout de la fonction de liste noire et de liste blanche en masse dans le backend

## 2024.12.13

Ajouter des fonctionnalités :

- Optimisation de la stratégie de cache pour les états de retour tels que blockimg, whitelistmode, 404, afin de réduire au maximum les demandes de retour (voir la documentation `3.1.3.9 optimisation des opérations de suppression, de mise en liste noire, etc. dans le backend`)

## 2024.12.12

Ajouter des fonctionnalités : 

- Le backend prend en charge le changement automatique vers d'autres canaux en cas d'échec de téléchargement
- Optimisation de l'affichage des états de retour 404, blockimg, whitelistmode, etc.

## 2024.12.11

Ajouter des fonctionnalités :

- Lors de la suppression, de l'ajout à la liste blanche, de l'ajout à la liste noire, etc., suppression automatique du cache CDN CF pour éviter les délais d'effet (voir la documentation `3.1.3.9 optimisation des opérations de suppression, de mise en liste noire, etc. dans le backend`)

## 2024.12.10

Ajouter des fonctionnalités :

- Ajout d'un enregistrement de la taille des fichiers dans les détails des fichiers

## 2024.12.09

Ajouter des fonctionnalités :

- Ouverture de plus de formats de fichiers

Corriger des bugs :

- Ajout d'un en-tête `access-control-allow-origin: *` pour permettre les requêtes inter-domaines dans les en-têtes de réponse des fichiers

## 2024.12.04

Ajouter des fonctionnalités :

- Prise en charge de la méthode de nommage personnalisée (soit nom d'origine, soit préfixe aléatoire, soit préfixe aléatoire\_nom d'origine par défaut)
- Enregistrement des données du robot et du canal lors du téléchargement de fichiers dans le canal Telegram, facilitant la migration et la sauvegarde
- Prise en charge de la personnalisation du préfixe de lien

Corriger des bugs :

- Suppression synchronisée du compartiment lors de la suppression du canal R2 dans le backend

## 2024.11.05

Ajouter des fonctionnalités :

- Ajout de la prise en charge des compartiments R2

## 2024.10.20

Ajouter des fonctionnalités :

- Ajout de la fonction de portail personnalisé dans le pied de page

## 2024.09.28

Ajouter des fonctionnalités :

- Reconstruction du style de la barre d'outils en bas à droite de la page de téléchargement, prise en charge de la compression personnalisée de la page de téléchargement (avant le téléchargement + côté stockage)
- Ajout de la possibilité de supprimer uniquement les images téléchargées avec succès et de réessayer les images échouées

## 2024.09.27

Ajouter des fonctionnalités :

- Lors du clic sur un lien sur la page de téléchargement, il est automatiquement copié dans le presse-papiers
- Mémorisation des paramètres de téléchargement (méthode de téléchargement, format de lien, etc.)

Corriger des bugs :

- Si aucun mot de passe n'est défini, il n'est pas nécessaire de rediriger vers la page de connexion

## 2024.09