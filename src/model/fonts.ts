import {FontLoader} from 'three/addons/loaders/FontLoader.js';
import regular from 'three/examples/fonts/helvetiker_regular.typeface.json';
import signage from './sign-font.json';

// Shared immutable font definitions. TextGeometry owns the generated geometry.
const loader=new FontLoader();
export const campusFont=loader.parse(regular);
export const campusSignFont=loader.parse(signage);
