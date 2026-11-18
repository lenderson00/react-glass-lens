<div align="center">

# 🔍 react-glass-lens

**Vidro de verdade pro DOM.**
Uma lente arrastável que refrata o que o React renderiza embaixo dela — não é blur, não é `scale`, é raio de luz.

[![license](https://img.shields.io/badge/license-MIT-111)](LICENSE)
![WebGL2](https://img.shields.io/badge/WebGL2-111)
![TypeScript](https://img.shields.io/badge/TypeScript-111)

</div>

---

## Por que isso existe

Todo mundo já viu aquele efeito de lupa de vidro em portfólio bonito: o centro amplia, a borda entorta, aparece uma
franja colorida e o mundo vira de cabeça pra baixo perto da beirada. A maioria é imagem estática ou truque de CSS.

Eu queria **a coisa de verdade**, funcionando em cima de qualquer conteúdo React — texto, imagem, componente, o que for.
Então o shader traça um raio de luz por pixel através de uma cúpula de vidro (lei de Snell nas duas superfícies),
separa os comprimentos de onda onde as cores realmente se afastam e devolve isso a 60 fps.

## O que tem

- 🔬 **Refração real** — raio por pixel, não imagem ampliada com filtro.
- 🌈 **Dispersão espectral** — franjas coloridas suaves, só onde as cores se separam.
- 🧩 **Qualquer conteúdo React** — renderizado uma vez, estado/foco/cliques continuam funcionando.
- ⚡ **60 fps** — mover a lente é uma draw call. Arrasta, arremessa com inércia, segue o cursor ou controla por código.
- 🧊 **Vidro fosco** — `frost` desfoca o que passa pela lente.
- 🪟 **Preset Liquid Glass** — vidro de UI no estilo do da Apple (sem zoom, centro limpo, refração só na borda).
- 🧪 **HTML-in-Canvas** — modo experimental que mantém vídeo e animação **vivos** debaixo do vidro.
- ♿ **Acessível** — foco visível, controle por setas, respeita `prefers-reduced-motion`.
- 📦 **Tipado e pequeno** — TypeScript, ~13 kB gzip, ESM + CJS, uma dependência.

## Instalação

```sh
npm i react-glass-lens
```

React 18 ou 19.

> ⚠️ O pacote **ainda não foi publicado no npm**. Até lá, clone o repositório e rode o site/playground
> (veja [Documentação](#documentação)) — o código da lib está em `packages/react-glass-lens`.

## Uso

```tsx
import { LensStage } from 'react-glass-lens';

export function Hero() {
  return (
    <LensStage style={{ height: 480 }}>
      <SeuConteudo />
    </LensStage>
  );
}
```

O `LensStage` é um bloco `position: relative` — dê um tamanho a ele. Daí é só mexer nas props ou partir de um preset:

```tsx
import { LensStage, lensPresets } from 'react-glass-lens';

<LensStage config={lensPresets.liquid} frost={0.25}>
  <SeuConteudo />
</LensStage>;
```

Ordem de precedência: padrões < `config` < props individuais.

### Presets

| preset | cara dele |
| --- | --- |
| `crystal` | o padrão: zoom, borda que dobra, franja colorida |
| `orb` | bola de cristal — o mundo de cabeça pra baixo |
| `magnifier` | lupa com centro plano e borda curta |
| `droplet` | gota d'água, índice de refração 1.33 |
| `subtle` | quase imperceptível, só uma insinuação |
| `liquid` | vidro de UI no estilo Liquid Glass |

> O `liquid` é inspirado no visual do Liquid Glass da Apple. Sem afiliação nem endosso — "Apple" e "Liquid Glass" são
> marcas dos respectivos donos.

### As props que mais importam

| prop | padrão | o que faz |
| --- | --- | --- |
| `radius` | `258` | raio da lente em px |
| `magnification` | `1.75` | zoom no centro (exato) |
| `ior` | `1.52` | índice de refração (1.33 água · 1.52 vidro · 2.4 diamante) |
| `aberration` | `0.054` | dispersão cromática (`0` desliga) |
| `thickness` | `0.6` | altura do domo ÷ raio |
| `refraction` | `0.3` | distância vidro → conteúdo; quanto maior, mais a borda dobra |
| `frost` | `0` | vidro fosco (0–1) |
| `mode` | `'drag'` | `'drag'` · `'follow'` · `'static'` |
| `capture` | `'snapshot'` | `'snapshot'` · `'html-in-canvas'` · `'auto'` |

A lista completa (com tipos, callbacks e a API por `ref`) está na [documentação](#documentação).

## HTML-in-Canvas (experimental)

Por padrão a lente tira um *snapshot* do conteúdo quando o DOM muda (~35–50 ms na thread principal). Com
[HTML-in-Canvas](https://github.com/WICG/html-in-canvas) o palco vira um `<canvas content="drawable">` e o navegador
manda os pixels vivos pro WebGL a cada frame:

```tsx
<LensStage capture="html-in-canvas">
  <VideoWall /> {/* vídeo, canvas e animação CSS continuam vivos sob o vidro */}
</LensStage>
```

Fica honesto aqui: a API ainda é experimental (Chromium, atrás de flag). Onde ela não existe — ou se falhar — a lente
volta sozinha pro snapshot. **Eu implementei seguindo a spec atual, mas ainda não consegui testar com a API ligada de
verdade.** Se você testar, abre uma issue contando como foi 🙏

## Como funciona

1. **Captura** — o palco vira textura (um `foreignObject` SVG rasterizado pelo navegador), com mipmaps e filtro
   anisotrópico. A própria lente fica de fora.
2. **Traçado** — um fragment shader modela uma cúpula de vidro sobre o conteúdo. Pra cada pixel ele refrata o raio no
   topo curvo, de novo na base plana, e segue até o conteúdo. O centro é normalizado, então `magnification` é exato; a
   borda dobra, comprime e por fim inverte a imagem.
3. **Dispersão** — onde as cores se separam, o raio é traçado em vários comprimentos de onda e recombinado.
4. **Luz** — Fresnel, brilho especular e sombra projetada, tudo a partir das mesmas normais.

Mexer a lente só troca *uniforms*. A textura é atualizada quando o DOM muda, quando transições terminam, quando fontes
carregam e quando o tema troca — com capturas agrupadas, pausadas fora da tela e limitadas durante rajadas.

## Performance

Medido no Chrome, RTX 2080 Ti, tela 1×:

| cenário | resultado |
| --- | --- |
| arrastar a lente | 60 fps, pior frame ~17 ms |
| shader (lente de ~820 px) | ~0,4 ms de GPU |
| captura do conteúdo | ~35–50 ms (uma vez por mudança no DOM) |

Pixels fora do vidro não gastam nada, e a dispersão só é calculada onde as cores realmente se separam. Se você tem um
palco enorme, `quality` mais baixo ajuda.

## Limitações (sendo sincero)

- A lente é **circular**. Formas de pílula/retângulo arredondado (tipo botão do iOS) ainda não existem.
- No modo snapshot, conteúdo que muda sem mexer no DOM (vídeo, `<canvas>`, animação CSS infinita) precisa de
  `refreshInterval` ou `ref.refresh()`.
- Imagens de outra origem precisam de CORS pra aparecer na captura.
- Sem WebGL2 a lente não aparece — o conteúdo renderiza normal e `onError` dispara.

## Documentação

Rode o site localmente — ele tem **docs completas**, **demo ao vivo** e um **playground** com sliders e gerador de
código:

```sh
git clone https://github.com/lenderson00/react-glass-lens.git
cd react-glass-lens
npm install
npm run dev
```

Abra http://localhost:5199. Rotas: `#/` visão geral · `#/docs` documentação · `#/playground` playground.

O playground gera o JSX com só o que difere do padrão — mexe nos sliders, copia, cola no seu projeto.

## Estrutura do repositório

```
packages/react-glass-lens/   o pacote npm (código, build, README do npm)
src/
  site/                      site de documentação (Vite + React)
  playground/                playground interativo
```

O site importa o pacote **direto do código-fonte**, então qualquer mudança na lib aparece na hora.

| comando | o que faz |
| --- | --- |
| `npm run dev` | site + playground em http://localhost:5199 |
| `npm run build` | build da lib (`packages/react-glass-lens/dist`) e do site (`dist/`) |
| `npm run build:lib` | só a lib: ESM, CJS, source maps e `.d.ts` |
| `npm run typecheck` | typecheck do site e da lib |
| `npm run pack:lib` | `npm pack --dry-run` — o que seria publicado |

## Contribuindo

Issues e PRs são bem-vindos. Ajuda especialmente:

- testar o modo `html-in-canvas` em um Chrome com a API ligada;
- testar em GPUs fracas / mobile e contar o FPS (a aba **Render** do playground mostra);
- formas de lente além do círculo.

Antes de abrir PR: `npm run typecheck && npm run build`.

## Licença

[MIT](LICENSE) © Lenderson Macedo
