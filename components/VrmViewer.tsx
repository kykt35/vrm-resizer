import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils, type VRM } from '@pixiv/three-vrm';

interface VrmViewerProps {
  arrayBuffer: ArrayBuffer;
}

const VrmViewer: React.FC<VrmViewerProps> = ({ arrayBuffer }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasWrapperRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    const container = containerRef.current;
    const canvasMount = canvasWrapperRef.current;
    if (!container || !canvasMount) {
      return;
    }

    let isMounted = true;
    setStatus('loading');

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth || 400, container.clientHeight || 360);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    canvasMount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x080810);

    const camera = new THREE.PerspectiveCamera(38, (container.clientWidth || 400) / (container.clientHeight || 360), 0.1, 50);
    camera.position.set(0, 1.3, 2.7);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1, 0);
    controls.enableDamping = true;

    scene.add(new THREE.HemisphereLight(0xffffff, 0x111122, 0.8));
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
    directionalLight.position.set(0, 5, 5);
    scene.add(directionalLight);

    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));

    let vrmModel: VRM | null = null;
    let frameId: number;

    loader.parse(
      arrayBuffer,
      '',
      (gltf) => {
        if (!isMounted) {
          return;
        }

        const vrm = gltf.userData.vrm as VRM | undefined;
        if (!vrm) {
          console.error('The GLTF result did not contain a VRM instance.');
          setStatus('error');
          return;
        }

        vrmModel = vrm;
        VRMUtils.removeUnnecessaryJoints(vrm.scene);
        vrm.scene.rotation.y = Math.PI;
        scene.add(vrm.scene);
        setStatus('ready');
      },
      (error) => {
        if (!isMounted) {
          return;
        }

        console.error('Failed to load VRM preview', error);
        setStatus('error');
      },
    );

    const clock = new THREE.Clock();
    const render = () => {
      frameId = requestAnimationFrame(render);
      controls.update();
      renderer.render(scene, camera);
    };
    render();

    const resizeObserver = new ResizeObserver(() => {
      const node = containerRef.current;
      if (!node) {
        return;
      }

      const { clientWidth, clientHeight } = node;
      if (!clientWidth || !clientHeight) {
        return;
      }

      renderer.setSize(clientWidth, clientHeight);
      camera.aspect = clientWidth / clientHeight;
      camera.updateProjectionMatrix();
    });
    resizeObserver.observe(container);

    return () => {
      isMounted = false;
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      controls.dispose();
      renderer.dispose();

      scene.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) {
          return;
        }

        object.geometry?.dispose();

        const { material } = object;
        if (!material) {
          return;
        }

        if (Array.isArray(material)) {
          material.forEach((materialItem) => materialItem.dispose());
        } else {
          material.dispose();
        }
      });

      if (vrmModel) {
        scene.remove(vrmModel.scene);
      }

      if (canvasMount.contains(renderer.domElement)) {
        canvasMount.removeChild(renderer.domElement);
      }
    };
  }, [arrayBuffer]);

  const overlay =
    status === 'loading'
      ? 'Rendering preview...'
      : status === 'error'
        ? 'Preview failed to load.'
        : null;

  return (
    <div ref={containerRef} className="relative w-full min-h-[400px] rounded-lg border border-gray-700 bg-[#080810] overflow-hidden">
      <div ref={canvasWrapperRef} className="absolute inset-0 z-0" />
      {overlay && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center text-sm font-medium text-gray-400">
          {overlay}
        </div>
      )}
    </div>
  );
};

export default VrmViewer;
