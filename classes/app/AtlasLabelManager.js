import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

import { getLocationByName, getBodyByName, getSystemByName } from '../../HelperFunctions.js';
import { setFocus } from '../../atlas.js';
import DB from './Database.js';
import SolarSystem from '../SolarSystem.js';
import Star from '../Star.js';
import CelestialBody from '../CelestialBody.js';
import Location from '../Location.js';

class AtlasLabelManager {
    constructor() {
        if (AtlasLabelManager.instance) return AtlasLabelManager.instance;
        AtlasLabelManager.instance = this;

        this.scene = null;
        this.allLabels = Array();
    }

    createLabel(target, groupObject = null) {
        if (target instanceof SolarSystem) {
            this.#createLabel_SolarSystem(target);

        } else if (target instanceof CelestialBody) {
            this.#createLabel_CelestialBody(target, groupObject);

        } else if (target instanceof Location) {
            this.#createLabel_Location(target)
        }
    }

    #createLabel_SolarSystem(system) {
        const div = document.createElement('div');
        div.classList.add('atlas-label');
        div.classList.add('atlas-label-system');
        div.dataset.objectType = 'Solar System';
        div.dataset.affiliation = system.AFFILIATION;
        div.dataset.objectName = system.NAME;

        this.#setLabelEvents(div, system);

        const nameElement = document.createElement('p');
        nameElement.classList.add('atlas-label-name');
        nameElement.innerText = system.NAME;
        div.appendChild(nameElement);

        // Ajoute un eventListener pour navigation animée sur le label système
        nameElement.addEventListener('pointerdown', (e) => {
            if (e.button !== 0) return;
            e.stopPropagation();
            let target = system;
            document.dispatchEvent(new CustomEvent('atlasFocusBreadcrumb', { detail: { object: target, typeLevel: 'star' } }));
        });

        const label = new CSS2DObject(div);
        label.position.copy(new THREE.Vector3(system.COORDINATES.x, system.COORDINATES.y, system.COORDINATES.z));

        this.scene.add(label);
        this.allLabels.push(label);
    }

    #createLabel_CelestialBody(body, group) {
        const div = document.createElement('div');
        div.classList.add('atlas-label');
        div.dataset.objectType = body.TYPE;
        div.dataset.systemName = body.TYPE === 'Star' ? body.NAME : body.PARENT_STAR.NAME;
        div.dataset.parentName = body.TYPE === 'Star' ? null : body.PARENT.NAME;
        div.dataset.objectName = body.NAME;
        div.dataset.visible = false;

        this.#setLabelEvents(div, body);

        /*const iconElement = document.createElement('div');
        iconElement.classList.add('mapLocationIcon');
        setBodyIcon(body.TYPE, iconElement);
        iconElement.style.marginTop = '15px';
        div.appendChild(iconElement);*/

        const nameElement = document.createElement('p');
        nameElement.classList.add('atlas-label-name');
        nameElement.innerText = body.NAME;
        div.appendChild(nameElement);

        // Ajoute un eventListener pour zoom animé sur le label
        nameElement.addEventListener('pointerdown', (e) => {
            if (e.button !== 0) return;
            e.stopPropagation();
            let typeLevel = (body.TYPE === 'Moon') ? 'moon' : (body.TYPE === 'Planet' ? 'planet' : (body.TYPE === 'Star' ? 'star' : 'other'));
            let target = body;
            if (typeLevel === 'star' && body.PARENT_SYSTEM && body.PARENT_SYSTEM.NAME && body.NAME === body.PARENT_SYSTEM.NAME) {
                target = DB.systems.find(sys => sys.NAME === body.PARENT_SYSTEM.NAME) || body.PARENT_SYSTEM;
            } else if (typeLevel === 'planet' || typeLevel === 'moon') {
                target = DB.bodies.find(b => b.NAME === body.NAME) || body;
            }
            // Si on clique sur un label de planète, zoom "proche" (zoom normal)
            let customZoom = undefined;
            if (typeLevel === 'planet' && typeof window.getRecommendedZoomForObject === 'function') {
                customZoom = window.getRecommendedZoomForObject(target);
            }
            document.dispatchEvent(new CustomEvent('atlasFocusBreadcrumb', { detail: { object: target, typeLevel, zoom: customZoom } }));
        });

        // INDICATE STATION PRESENCE AT LAGRANGE POINTS
        if (body.TYPE === 'Lagrange Point') {
            let children = [];
            for (let loc of DB.locations) {
                if (loc.PARENT.NAME === body.NAME) {
                    children.push(loc.NAME);
                }
            }

            if (children.length > 0) {
                let newString = nameElement.innerText;
                for (let str of children) {
                    newString += `\n${str}`;
                }
                nameElement.innerText = newString;
            }
        }

        const label = new CSS2DObject(div);
        const labelPosition = new THREE.Vector3(body.COORDINATES.x, body.COORDINATES.y, body.COORDINATES.z);
        label.position.copy(labelPosition);

        group.add(label);
        this.allLabels.push(label);
    }

    #createLabel_Location(location) {
        const div = document.createElement('div');
        div.classList.add('atlas-label');
        div.dataset.objectType = 'Location';
        div.dataset.objectName = location.NAME;
        div.dataset.systemName = location.PARENT_STAR ? location.PARENT_STAR.NAME : '';
        div.dataset.bodyName = location.PARENT ? location.PARENT.NAME : '';
        div.dataset.visible = false;

        this.#setLabelEvents(div, location);

        // Icône POI
        const iconElement = document.createElement('div');
        this.#setLocationIcon(location.TYPE, iconElement);
        iconElement.style.marginTop = '10px';
        div.appendChild(iconElement);

        // Nom
        const nameElement = document.createElement('p');
        nameElement.classList.add('atlas-label-name');
        nameElement.innerText = location.NAME;
        div.appendChild(nameElement);

        // Heure locale
        const timeElement = document.createElement('p');
        timeElement.classList.add('atlas-label-time');
        timeElement.innerText = this.#getLocalTimeString(location);
        div.appendChild(timeElement);

        // Infobox détaillé au survol (seulement si visible)
        div.addEventListener('mouseenter', (e) => {
            if (div.dataset.visible === 'true') {
                this.#showAtlasLocationInfobox(location, div);
            }
        });
        div.addEventListener('mouseleave', (e) => {
            this.#hideAtlasLocationInfobox();
        });

        // Zoom animé sur le label de location (lune, POI, etc.)
        nameElement.addEventListener('pointerdown', (e) => {
            if (e.button !== 0) return;
            e.stopPropagation();
            // On cible le parent (corps céleste) pour le focus
            let parentBody = DB.bodies.find(b => b.NAME === location.PARENT.NAME);
            let typeLevel = (location.PARENT.TYPE === 'Moon') ? 'moon' : (location.PARENT.TYPE === 'Planet' ? 'planet' : 'other');
            let target = parentBody || location.PARENT;
            document.dispatchEvent(new CustomEvent('atlasFocusBreadcrumb', { detail: { object: target, typeLevel } }));
        });

        const label = new CSS2DObject(div);
        let labelPosition;
        if (Number.isFinite(location.COORDINATES_3DMAP.x)) {
            labelPosition = new THREE.Vector3(
                location.COORDINATES_3DMAP.x * -1 * location.PARENT.BODY_RADIUS,
                location.COORDINATES_3DMAP.y * location.PARENT.BODY_RADIUS,
                location.COORDINATES_3DMAP.z * location.PARENT.BODY_RADIUS
            );
            labelPosition.applyAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI);
        } else {
            labelPosition = new THREE.Vector3(
                location.COORDINATES.x,
                location.COORDINATES.y,
                location.COORDINATES.z
            )
        }
        label.position.copy(labelPosition);

        label.userData.parentType = location.PARENT.TYPE;

        if (
            location.PARENT.TYPE === 'Planet' ||
            location.PARENT.TYPE === 'Moon' ||
            location.PARENT.TYPE === 'Lagrange Point' ||
            location.PARENT.TYPE === 'Jump Point'
        ) {
            const containerObject = this.scene.getObjectByName(`BODYCONTAINER:${location.PARENT.NAME}`);
            containerObject.add(label);
        } else {
            const system = this.scene.getObjectByName(`SYSTEM:${location.PARENT_STAR.NAME}`);
            system.add(label);
        }

        this.allLabels.push(label);
    }

    // Copie la logique d'icône de map.js
    #setLocationIcon(type, element) {
        element.classList.add('mapLocationIcon');
        element.classList.add('atlas-label-icon');
        if (
            type === 'Emergency shelter' ||
            type === 'Outpost' ||
            type === 'Prison' ||
            type === 'Shipwreck' ||
            type === 'Scrapyard'
        ) {
            element.classList.add('icon-outpost');
        } else if (type === 'Underground bunker') {
            element.classList.add('icon-bunker');
        } else if (
            type === 'Space station' ||
            type === 'Asteroid base' ||
            type === 'Orbital laser platform'
        ) {
            element.classList.add('icon-spacestation');
        } else if (type === 'Landing zone') {
            element.classList.add('icon-landingzone');
        } else if (type === 'Settlement') {
            element.classList.add('icon-settlement');
        } else {
            element.classList.add('icon-space');
        }
    }

    // Affiche la vraie heure locale (utilise getCustomTime si dispo, sinon UTC)
    #getLocalTimeString(location) {
        // Utilise la propriété LOCAL_TIME de Location et convertHoursToTimeString pour afficher l'heure locale en jeu
        if (location && typeof location.LOCAL_TIME === 'number') {
            // LOCAL_TIME est en secondes, converti en heures
            const hours = location.LOCAL_TIME / 3600;
            // convertHoursToTimeString est importé depuis HelperFunctions.js
            if (typeof window.convertHoursToTimeString === 'function') {
                return window.convertHoursToTimeString(hours, false);
            } else if (typeof convertHoursToTimeString === 'function') {
                return convertHoursToTimeString(hours, false);
            }
            // Fallback simple
            const h = Math.floor(hours).toString().padStart(2, '0');
            const m = Math.floor((hours % 1) * 60).toString().padStart(2, '0');
            return `${h}:${m}`;
        }
        return '--:--';
    }

    // Affiche un infobox détaillé au survol
    #showAtlasLocationInfobox(location, labelDiv) {
        let infoBox = document.getElementById('atlas-hoverinfo');
        if (!infoBox) return;
    infoBox.innerHTML = `<b>${location.NAME}</b><br>Type: ${location.TYPE}<br>Parent: ${location.PARENT ? location.PARENT.NAME : ''}<br>System: ${location.PARENT_STAR ? location.PARENT_STAR.NAME : ''}`;
        infoBox.style.opacity = '1';
        infoBox.style.pointerEvents = 'auto';
        infoBox.style.zIndex = '9999';
        infoBox.style.background = 'rgba(20,20,30,0.97)';
        infoBox.style.color = '#fff';
        infoBox.style.padding = '8px 12px';
        infoBox.style.borderRadius = '8px';
        infoBox.style.boxShadow = '0 2px 8px #000a';
        // Positionne l'infobox à côté du label
        const rect = labelDiv.getBoundingClientRect();
        infoBox.style.left = `${rect.right + 10}px`;
        infoBox.style.top = `${rect.top}px`;
        infoBox.style.display = 'block';
    }

    #hideAtlasLocationInfobox() {
        let infoBox = document.getElementById('atlas-hoverinfo');
        if (infoBox) {
            infoBox.style.opacity = '0';
            infoBox.style.display = 'none';
        }
    }

    #setBodyIcon(type, element) {
        element.classList.add('mapLocationIcon');
        element.classList.add('atlas-label-icon');

        if (type === 'Star') {
            element.classList.add('icon-star');

        } else if (type === 'Planet' || type === 'Moon') {
            element.classList.add('icon-planet');

        } else if (type === 'Jump Point') {
            element.classList.add('icon-wormhole');

            /*	} else if (
                    type === 'Underground bunker' ||
                    type === 'Emergency shelter' ||
                    type === 'Outpost' ||
                    type === 'Prison' ||
                    type === 'Shipwreck' ||
                    type === 'Scrapyard' ||
                    type === 'Settlement'
                ) {
                    element.classList.add('icon-outpost');
            
                } else if (
                    type === 'Space station' ||
                    type === 'Asteroid base'
                ) {
                    element.classList.add('icon-spacestation');
            
                } else if (type === 'Landing zone') {
                    element.classList.add('icon-landingzone');*/

        } else {
            element.classList.add('icon-space');
        }
    }

    #setLabelEvents(domElement, targetObject) {
        // Ne rien faire pour les POI (Location)
        if (targetObject instanceof Location) return;
        domElement.addEventListener('pointerdown', (event) => {
            if (event.button === 0) {
                setFocus(targetObject);
            }
        });
        // (On peut garder les events infobox plus tard si besoin)
        return;
    }

    organize(distance, visibility, camera, focusBody) {
        this.#organizeLabels_resetAll();
        this.#organizeLabels_byFocus(focusBody);
        this.#organizeLabels_byDistance(distance, visibility);
        this.#organizeLabels_hideOccluded(camera, focusBody);
    }

    #organizeLabels_resetAll() {
        for (const label of this.allLabels) {
            label.element.dataset.visible = true;
            label.element.dataset.occluded = false;
        }
    }

    #organizeLabels_byDistance(distance, visibility) {
        for (const label of this.allLabels) {
            if (label.element.dataset.visible === 'false') continue; 

            const type = label.element.dataset.objectType;
            
            if (type === 'Solar System') {
                label.element.dataset.visible = visibility;

            } else if (
                type === 'Star' ||
                type === 'Planet'
            ) {
                if (visibility) {
                    label.element.dataset.visible = false;
                }

                if (distance < 0.003) {
                    label.element.dataset.visible = false;
                }

            } else if (type === 'Lagrange Point' || type === 'Jump Point') {
                if (distance > 8 || distance < 0.025) {
                    label.element.dataset.visible = false;
                }

            } else if (type === 'Moon') {
                if (distance > 0.25 || distance < 0.003) {
                    label.element.dataset.visible = false;
                }

            } else if (type === 'Location') {
                let triggerDistance = 0.003;

                if (label.userData.parentType === 'Lagrange Point' || label.userData.parentType === 'Jump Point') {
                    triggerDistance = 0.025;
                }

                if (distance > triggerDistance) {
                    label.element.dataset.visible = false;
                }
            }
        }
    }

    #organizeLabels_byFocus(focusBody) {
        let focusSystemName;
        if (focusBody instanceof Star) {
            focusSystemName = focusBody.NAME;
        } else {
            focusSystemName = focusBody.PARENT_STAR.NAME;
        }

        for (const label of this.allLabels) {
            if (label.element.dataset.visible === 'false') continue;

            const type = label.element.dataset.objectType;
            const systemName = label.element.dataset.systemName;

            if (type === 'Solar System') {
                continue;

            } else if (type === 'Moon') {
                const body = getBodyByName(label.element.textContent);
                const parent = body.PARENT;

                if (
                    focusBody.NAME !== body.NAME &&
                    focusBody.NAME !== parent.NAME &&
                    focusBody.PARENT?.NAME !== parent.NAME
                ) {
                    label.element.dataset.visible = false;
                }

            } else if (type === 'Location') {

                if (focusSystemName !== systemName) {
                    label.element.dataset.visible = false;
                    continue;
                }

                if (label.element.dataset.bodyName !== focusBody.NAME) {
                    label.element.dataset.visible = false;
                }

            } else {
                if (focusSystemName !== systemName) {
                    label.element.dataset.visible = false;
                }
            }
        }
    }

    #organizeLabels_hideOccluded(camera, focusBody) {
        const objectMesh = this.scene.getObjectByName(focusBody.NAME);
        const raycaster = new THREE.Raycaster();

        for (const label of this.allLabels) {
            if (label.element.dataset.visible === 'false') continue;

            const pos = new THREE.Vector3()
            label.getWorldPosition(pos);

            const dir = new THREE.Vector3().copy(pos).sub(camera.position).normalize().negate();

            raycaster.set(pos, dir);
            const intersects = raycaster.intersectObject(objectMesh, false);

            if (intersects.length > 0) {
                label.element.dataset.occluded = true;
            } else {
                label.element.dataset.occluded = false;
            }
        }
    }
}

const LabelManager = new AtlasLabelManager(null);
export default LabelManager;