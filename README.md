# Nightfall Zombies

Prototype FPS zombies mobile/WebGL reconstruit à partir du projet Nightfall Zombies précédent.

## Gameplay
- Carte 3D avec murs, couloirs, obstacles et collisions
- Joystick gauche : déplacement / strafe
- Swipe à droite : visée libre
- Arme 3D en vue FPS avec recul, muzzle flash et animation de recharge
- Zombies normaux, brutes et boss
- Headshots, combos, vibrations et score
- Vagues progressives et choix d'amélioration entre les manches
- HUD mobile, points de vie, munitions, compteur de zombies
- Éclairage renforcé : ambiance nocturne lisible, lampe torche, éclairages chauds/froids
- PWA installable

## Lancer le jeu
Le projet utilise les modules ES de Three.js via CDN. Servez le dossier avec un petit serveur HTTP :

```bash
python3 -m http.server 8080
```

Puis ouvrez `http://localhost:8080`.

## iPhone
Le jeu est pensé pour le mode paysage. Pour une vraie publication App Store avec Core Haptics, Game Center et achats intégrés, empaquetez cette version WebGL avec Capacitor ou migrez le gameplay vers un moteur natif.

## Assets / IP
Cette reconstruction utilise des formes, sons synthétiques et interfaces originales. Aucun asset, son ou code propriétaire de Call of Duty / Black Ops n'est inclus.
