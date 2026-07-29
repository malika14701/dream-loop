import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

export class PostProcessing {
  constructor(renderer, scene, camera) {
    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, camera));

    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.3, 0.4, 0.1
    );
    this.composer.addPass(this.bloomPass);

    this.customPass = new ShaderPass({
      uniforms: {
        tDiffuse: { value: null },
        time: { value: 0 },
        intensity: { value: 0.003 },
        grainAmount: { value: 0.02 },
        vignetteDark: { value: 0.4 },
      },
      vertexShader: [
        'varying vec2 vUv;',
        'void main() {',
        '  vUv = uv;',
        '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
        '}',
      ].join('\n'),
      fragmentShader: [
        'uniform sampler2D tDiffuse;',
        'uniform float time;',
        'uniform float intensity;',
        'uniform float grainAmount;',
        'uniform float vignetteDark;',
        'varying vec2 vUv;',
        'float hash(vec2 p) {',
        '  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);',
        '}',
        'void main() {',
        '  vec2 uv = vUv;',
        '  vec2 offset = (uv - 0.5) * intensity;',
        '  float r = texture2D(tDiffuse, uv + offset).r;',
        '  float g = texture2D(tDiffuse, uv).g;',
        '  float b = texture2D(tDiffuse, uv - offset).b;',
        '  vec4 color = vec4(r, g, b, 1.0);',
        '  float grain = (hash(uv + time * 0.1 + floor(time * 60.0) * 0.01) - 0.5) * grainAmount;',
        '  color.rgb += grain;',
        '  float dist = distance(uv, vec2(0.5, 0.5));',
        '  float vignette = 1.0 - dist * vignetteDark;',
        '  color.rgb *= vignette;',
        '  gl_FragColor = color;',
        '}',
      ].join('\n'),
    });

    this.customPass.renderToScreen = true;
    this.composer.addPass(this.customPass);

    this.enabled = true;
    this.bloomEnabled = true;

    this._onResize = () => this.composer.setSize(window.innerWidth, window.innerHeight);
    window.addEventListener('resize', this._onResize);
  }

  setBloom(enabled) {
    this.bloomEnabled = enabled;
    this.bloomPass.strength = enabled ? 0.3 : 0;
  }

  update(time, delta, intensity) {
    if (!this.enabled) return;
    this.customPass.uniforms.time.value = time;
    this.customPass.uniforms.intensity.value = 0.003 + intensity * 0.01;
    this.customPass.uniforms.grainAmount.value = 0.02 + intensity * 0.05;
    this.customPass.uniforms.vignetteDark.value = 0.4 + intensity * 0.3;
  }

  render() {
    if (this.enabled) {
      this.composer.render();
    }
  }

  dispose() {
    if (this._onResize) window.removeEventListener('resize', this._onResize);
  }
}
