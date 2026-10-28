import React, { useEffect, useRef } from "react";
import * as THREE from "three";

interface ThreeBackgroundProps {
  className?: string;
  interactive?: boolean;
}

export const ThreeBackground: React.FC<ThreeBackgroundProps> = ({
  className = "",
  interactive = true,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      });
    } catch {
      console.warn("WebGL não disponível.");
      return;
    }

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    camera.position.z = 82;

    // ── Gerador de Textura Radial Suave para Nós e Fótons ──────────────────────
    const createGlowTexture = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;

      const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
      grad.addColorStop(0, "rgba(255, 255, 255, 1)");
      grad.addColorStop(0.2, "rgba(255, 255, 255, 0.95)");
      grad.addColorStop(0.45, "rgba(216, 180, 254, 0.65)");
      grad.addColorStop(0.7, "rgba(168, 85, 247, 0.25)");
      grad.addColorStop(1, "rgba(168, 85, 247, 0)");

      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 128, 128);

      const texture = new THREE.CanvasTexture(canvas);
      texture.needsUpdate = true;
      return texture;
    };

    const glowTexture = createGlowTexture();

    // ── 1. Poliedros Geométricos 3D com Linhas e Vértices Luminosos (Imagem 1) ─
    const polyGroup = new THREE.Group();
    scene.add(polyGroup);

    const createLuminousPolyhedron = (
      geometry: THREE.BufferGeometry,
      edgeColor: number,
      pos: [number, number, number],
      scale: number
    ) => {
      const group = new THREE.Group();

      // Linhas da wireframe brilhante com blending aditivo
      const wireGeo = new THREE.WireframeGeometry(geometry);
      const wireMat = new THREE.LineBasicMaterial({
        color: edgeColor,
        transparent: true,
        opacity: 0.75,
        blending: THREE.AdditiveBlending,
        linewidth: 2,
      });
      const lines = new THREE.LineSegments(wireGeo, wireMat);
      group.add(lines);

      // Pontos brilhantes nos vértices com textura radial
      if (glowTexture) {
        const pointsMat = new THREE.PointsMaterial({
          map: glowTexture,
          color: 0xffffff,
          size: 6.5,
          transparent: true,
          opacity: 0.95,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        const points = new THREE.Points(geometry, pointsMat);
        group.add(points);

        // Halo externo nos vértices
        const haloMat = new THREE.PointsMaterial({
          map: glowTexture,
          color: edgeColor,
          size: 14,
          transparent: true,
          opacity: 0.5,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        const halo = new THREE.Points(geometry, haloMat);
        group.add(halo);
      }

      group.position.set(...pos);
      group.scale.setScalar(scale);
      return group;
    };

    // Poliedro 1: Icosaedro grande superior esquerdo (Magenta neon vibrante)
    const poly1 = createLuminousPolyhedron(
      new THREE.IcosahedronGeometry(13.5, 1),
      0xf43f5e,
      [-42, 22, -8],
      1.15
    );
    polyGroup.add(poly1);

    // Poliedro 2: Dodecaedro inferior esquerdo (Violeta/Púrpura luminoso)
    const poly2 = createLuminousPolyhedron(
      new THREE.DodecahedronGeometry(11, 0),
      0xa855f7,
      [-46, -20, -5],
      1.05
    );
    polyGroup.add(poly2);

    // Poliedro 3: Octaedro/Tetraedro direito inferior (Azul elétrico / Ciano)
    const poly3 = createLuminousPolyhedron(
      new THREE.OctahedronGeometry(9, 0),
      0x60a5fa,
      [42, -22, -14],
      0.95
    );
    polyGroup.add(poly3);

    // Poliedro 4: Icosaedro superior direito sutil
    const poly4 = createLuminousPolyhedron(
      new THREE.IcosahedronGeometry(7, 0),
      0xc084fc,
      [46, 26, -20],
      0.85
    );
    polyGroup.add(poly4);

    // ── 2. Rede Neural & Conexões Fluidas entre Nós ────────────────────────────
    const nodeCount = 80;
    const baseCoords: THREE.Vector3[] = [];
    const currentCoords: THREE.Vector3[] = [];
    const velocities: THREE.Vector3[] = [];

    for (let i = 0; i < nodeCount; i++) {
      const x = (Math.random() - 0.5) * 145;
      const y = (Math.random() - 0.5) * 95;
      const z = (Math.random() - 0.5) * 35 - 5;
      const pos = new THREE.Vector3(x, y, z);
      baseCoords.push(pos.clone());
      currentCoords.push(pos.clone());
      velocities.push(
        new THREE.Vector3(
          (Math.random() - 0.5) * 0.05,
          (Math.random() - 0.5) * 0.05,
          (Math.random() - 0.5) * 0.025
        )
      );
    }

    // Geometria dos nós
    const nodesGeometry = new THREE.BufferGeometry().setFromPoints(currentCoords);

    // Nós com orbe luminoso de alta definição
    const nodesMaterial = new THREE.PointsMaterial({
      map: glowTexture || undefined,
      color: 0xffffff,
      size: glowTexture ? 7.0 : 3.5,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const nodesMesh = new THREE.Points(nodesGeometry, nodesMaterial);
    scene.add(nodesMesh);

    // Halo secundário colorido nos nós
    const nodesGlowMaterial = new THREE.PointsMaterial({
      map: glowTexture || undefined,
      color: 0xc084fc,
      size: glowTexture ? 16 : 7.0,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const nodesGlowMesh = new THREE.Points(nodesGeometry, nodesGlowMaterial);
    scene.add(nodesGlowMesh);

    // Linhas de conexão dinâmicas (capacidade para pares de nós + cursor)
    const maxConnections = (nodeCount * (nodeCount + 1)) / 2 + nodeCount;
    const linePositions = new Float32Array(maxConnections * 6);
    const lineColors = new Float32Array(maxConnections * 6);

    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute(
      "position",
      new THREE.BufferAttribute(linePositions, 3).setUsage(THREE.DynamicDrawUsage)
    );
    lineGeo.setAttribute(
      "color",
      new THREE.BufferAttribute(lineColors, 3).setUsage(THREE.DynamicDrawUsage)
    );

    const lineMat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      linewidth: 1.5,
      depthWrite: false,
    });
    const linesMesh = new THREE.LineSegments(lineGeo, lineMat);
    scene.add(linesMesh);

    // ── 3. Pulsos Sinápticos / Fótons que Viajam pelas Linhas (Efeito Mente) ───
    const pulseCount = 14;
    interface Pulse {
      fromIndex: number;
      toIndex: number;
      progress: number;
      speed: number;
      active: boolean;
    }
    const pulses: Pulse[] = [];
    for (let i = 0; i < pulseCount; i++) {
      pulses.push({
        fromIndex: 0,
        toIndex: 1,
        progress: 0,
        speed: 0.008 + Math.random() * 0.012,
        active: false,
      });
    }

    const pulseGeo = new THREE.BufferGeometry();
    const pulsePositions = new Float32Array(pulseCount * 3);
    pulseGeo.setAttribute("position", new THREE.BufferAttribute(pulsePositions, 3));
    const pulseMat = new THREE.PointsMaterial({
      map: glowTexture || undefined,
      color: 0x67e8f9, // ciano luminoso
      size: glowTexture ? 12 : 5,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const pulseMesh = new THREE.Points(pulseGeo, pulseMat);
    scene.add(pulseMesh);

    // ── 4. Poeira de Luz Cósmica Ambiente ───────────────────────────────────────
    const dustCount = 110;
    const dustGeo = new THREE.BufferGeometry();
    const dustPositions = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount * 3; i += 3) {
      dustPositions[i] = (Math.random() - 0.5) * 165;
      dustPositions[i + 1] = (Math.random() - 0.5) * 115;
      dustPositions[i + 2] = (Math.random() - 0.5) * 55;
    }
    dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPositions, 3));
    const dustMat = new THREE.PointsMaterial({
      map: glowTexture || undefined,
      color: 0xe9d5ff,
      size: glowTexture ? 4.5 : 1.5,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const dustMesh = new THREE.Points(dustGeo, dustMat);
    scene.add(dustMesh);

    // ── 5. Interação com Cursor (Magnetismo & Raios de Luz) ────────────────────
    let targetMouseX = 0;
    let targetMouseY = 0;
    let currentMouseX = 0;
    let currentMouseY = 0;
    const mouse3D = new THREE.Vector3(0, 0, 0);

    const handleMouseMove = (e: MouseEvent) => {
      if (!interactive) return;
      const normX = (e.clientX / window.innerWidth - 0.5) * 2;
      const normY = -(e.clientY / window.innerHeight - 0.5) * 2;
      targetMouseX = normX;
      targetMouseY = normY;

      // Posição no espaço tridimensional
      mouse3D.set(normX * 62, normY * 38, 0);
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });

    // ── 6. Resize ──────────────────────────────────────────────────────────────
    const handleResize = () => {
      if (!mountRef.current) return;
      const newW = mountRef.current.clientWidth || window.innerWidth;
      const newH = mountRef.current.clientHeight || window.innerHeight;
      camera.aspect = newW / newH;
      camera.updateProjectionMatrix();
      renderer.setSize(newW, newH);
    };

    window.addEventListener("resize", handleResize);

    // ── 7. Loop de Renderização e Animação Fluida ──────────────────────────────
    let animationFrameId: number;
    const connectionDist = 28;
    const cursorConnectionDist = 34;
    const clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      // Suavização do mouse com amortecimento (lerp)
      currentMouseX += (targetMouseX - currentMouseX) * 0.045;
      currentMouseY += (targetMouseY - currentMouseY) * 0.045;

      // Animação e flutuação dos poliedros
      poly1.rotation.x = elapsedTime * 0.15;
      poly1.rotation.y = elapsedTime * 0.18;
      poly1.position.y = 22 + Math.sin(elapsedTime * 0.8) * 2.4;

      poly2.rotation.x = -elapsedTime * 0.12;
      poly2.rotation.y = elapsedTime * 0.14;
      poly2.position.y = -20 + Math.cos(elapsedTime * 0.7) * 2.2;

      poly3.rotation.x = elapsedTime * 0.17;
      poly3.rotation.z = elapsedTime * 0.11;
      poly3.position.y = -22 + Math.sin(elapsedTime * 0.9) * 1.8;

      poly4.rotation.y = -elapsedTime * 0.13;
      poly4.rotation.z = -elapsedTime * 0.09;

      polyGroup.position.x = currentMouseX * 5.5;
      polyGroup.position.y = currentMouseY * 4.2;

      // Atualiza posições dos nós com física orgânica e atração magnética ao cursor
      const posAttr = nodesGeometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < nodeCount; i++) {
        const coord = currentCoords[i];
        const vel = velocities[i];

        coord.add(vel);

        // Rebater nas bordas suavemente
        if (coord.x < -74 || coord.x > 74) vel.x *= -1;
        if (coord.y < -49 || coord.y > 49) vel.y *= -1;
        if (coord.z < -28 || coord.z > 18) vel.z *= -1;

        // Efeito Magnético: nós próximos ao mouse sofrem atração elástica sutil
        if (interactive) {
          const dToMouse = coord.distanceTo(mouse3D);
          if (dToMouse < 26) {
            const pullFactor = (1 - dToMouse / 26) * 0.18;
            coord.x += (mouse3D.x - coord.x) * pullFactor;
            coord.y += (mouse3D.y - coord.y) * pullFactor;
          }
        }

        posAttr.setXYZ(i, coord.x, coord.y, coord.z);
      }
      posAttr.needsUpdate = true;

      // Calcular linhas de conexões nítidas e luminosas
      let lineIndex = 0;
      let colorIndex = 0;
      const activePairs: [number, number][] = [];

      for (let i = 0; i < nodeCount; i++) {
        const nodeA = currentCoords[i];

        // Conectar nó ao cursor se estiver próximo (Raios Magnéticos Interativos)
        const distToMouse = nodeA.distanceTo(mouse3D);
        if (interactive && distToMouse < cursorConnectionDist) {
          const mAlpha = 1 - distToMouse / cursorConnectionDist;
          const intensity = Math.pow(mAlpha, 1.2) * 0.95;

          linePositions[lineIndex++] = nodeA.x;
          linePositions[lineIndex++] = nodeA.y;
          linePositions[lineIndex++] = nodeA.z;

          linePositions[lineIndex++] = mouse3D.x;
          linePositions[lineIndex++] = mouse3D.y;
          linePositions[lineIndex++] = mouse3D.z;

          // Gradiente magenta radiante com ciano
          lineColors[colorIndex++] = 1.0 * intensity;
          lineColors[colorIndex++] = 0.5 * intensity;
          lineColors[colorIndex++] = 0.95 * intensity;

          lineColors[colorIndex++] = 0.6 * intensity;
          lineColors[colorIndex++] = 0.85 * intensity;
          lineColors[colorIndex++] = 1.0 * intensity;
        }

        // Conectar nós entre si
        for (let j = i + 1; j < nodeCount; j++) {
          const nodeB = currentCoords[j];
          const dist = nodeA.distanceTo(nodeB);

          if (dist < connectionDist) {
            if (activePairs.length < 120) {
              activePairs.push([i, j]);
            }

            const alpha = 1 - dist / connectionDist;
            const intensity = Math.pow(alpha, 1.25) * 0.85;

            linePositions[lineIndex++] = nodeA.x;
            linePositions[lineIndex++] = nodeA.y;
            linePositions[lineIndex++] = nodeA.z;

            linePositions[lineIndex++] = nodeB.x;
            linePositions[lineIndex++] = nodeB.y;
            linePositions[lineIndex++] = nodeB.z;

            // Gradiente vibrante (magenta fúcsia para violeta índigo radiante)
            lineColors[colorIndex++] = 0.88 * intensity;
            lineColors[colorIndex++] = 0.42 * intensity;
            lineColors[colorIndex++] = 1.0 * intensity;

            lineColors[colorIndex++] = 0.52 * intensity;
            lineColors[colorIndex++] = 0.68 * intensity;
            lineColors[colorIndex++] = 1.0 * intensity;
          }
        }
      }

      lineGeo.setDrawRange(0, lineIndex / 3);
      (lineGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      (lineGeo.attributes.color as THREE.BufferAttribute).needsUpdate = true;

      // Atualiza pulsos sinápticos ao longo das conexões
      const pulsePosAttr = pulseGeo.attributes.position as THREE.BufferAttribute;
      for (let p = 0; p < pulseCount; p++) {
        const pulse = pulses[p];
        if (!pulse.active && activePairs.length > 0) {
          const pair = activePairs[Math.floor(Math.random() * activePairs.length)];
          pulse.fromIndex = pair[0];
          pulse.toIndex = pair[1];
          pulse.progress = 0;
          pulse.active = true;
        }

        if (pulse.active) {
          pulse.progress += pulse.speed;
          if (pulse.progress >= 1) {
            pulse.active = false;
            pulsePosAttr.setXYZ(p, -9999, -9999, -9999);
          } else {
            const a = currentCoords[pulse.fromIndex];
            const b = currentCoords[pulse.toIndex];
            if (a && b) {
              const px = a.x + (b.x - a.x) * pulse.progress;
              const py = a.y + (b.y - a.y) * pulse.progress;
              const pz = a.z + (b.z - a.z) * pulse.progress;
              pulsePosAttr.setXYZ(p, px, py, pz);
            }
          }
        }
      }
      pulsePosAttr.needsUpdate = true;

      // Movimento suave da poeira estelar
      dustMesh.rotation.y = elapsedTime * 0.02;
      dustMesh.rotation.x = Math.sin(elapsedTime * 0.015) * 0.04;

      // Paralaxe suave da câmera
      camera.position.x = currentMouseX * 3.8;
      camera.position.y = currentMouseY * 2.8;
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("resize", handleResize);
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
      scene.clear();
      glowTexture?.dispose();
    };
  }, [interactive]);

  return (
    <div
      ref={mountRef}
      className={`mind-network-three ${className}`}
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 0,
        overflow: "hidden",
      }}
      aria-hidden="true"
    />
  );
};