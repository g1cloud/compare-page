# HTML 구조 비교 도구

이 CLI 도구는 두 웹 페이지의 HTML DOM 구조를 비교합니다. Playwright를 사용하여 페이지를 렌더링하고, 지정된 CSS 셀렉터 내부의 HTML 구조를 분석합니다. 텍스트 노드, 특정 속성들을 제외하고 순수하게 구조만을 비교하여, 두 페이지 간의 구조적 차이를 감지하는 데 사용됩니다.

## 설치 및 빌드

1.  **의존성 설치:**
    ```bash
    pnpm install
    ```

2.  **빌드:**
    ```bash
    pnpm build
    ```

## 사용법

CLI는 `html` 커맨드와 두 개의 URL, 그리고 여러 옵션을 인자로 받습니다.

```bash
node dist/index.js html <urlA> <urlB> [options]
```

개발 중에는 `pnpm start`를 사용하여 빌드 없이 실행할 수 있습니다.

```bash
pnpm start html <urlA> <urlB> [options]
```

### 옵션

| 옵션 | 축약형 | 설명 | 기본값 | 
| --- | --- | --- | --- | 
| `--selector <selector>` | `-s` | 비교할 HTML 엘리먼트를 지정하는 CSS 셀렉터입니다. | `body` | 
| `--out <prefix>` | | 생성될 결과 파일의 접두사(prefix)를 지정합니다. | `compare` | 
| `--exclude-attrs <attributes>` | | 비교에서 제외할 속성을 `태그:속성` 형식으로 지정합니다. 쉼표로 여러 개를 지정할 수 있습니다. | (없음) | 
| `--exclude-attr-regex <rule...>` | | 속성 값을 정규식으로 비교하여 제외합니다. `태그:속성:정규식` 형식이며, 여러 번 사용할 수 있습니다. | (없음) | 

### 기본 제외 규칙

아래 속성들은 옵션과 관계없이 항상 비교에서 제외됩니다.

-   값이 없는 속성 (e.g., `disabled`)
-   `data-*`로 시작하는 모든 속성
-   `aria-*`로 시작하는 모든 속성

## 예시

**1. 기본 비교**

두 페이지의 `<body>` 전체를 비교하고, 결과를 `compare_a.html`, `compare_b.html` 파일로 저장합니다.

```bash
pnpm start html https://example.com/page1 https://example.com/page2
```

**2. 특정 영역 및 파일 이름 지정**

`#main-content` 영역만 비교하고, 결과 파일을 `main_a.html`, `main_b.html`로 저장합니다.

```bash
pnpm start html <URL1> <URL2> -s "#main-content" --out "main"
```

**3. 속성 제외하여 비교**

`<img>` 태그의 `src` 속성과 `<a>` 태그의 `href` 속성을 무시하고 비교합니다.

```bash
pnpm start html <URL1> <URL2> --exclude-attrs "img:src,a:href"
```

**4. 정규식을 사용한 복합 비교**

- `id` 속성이 `ad-`로 시작하는 모든 엘리먼트 제외
- `<li>` 태그의 `class` 속성에 `active`가 포함된 경우 제외

```bash
pnpm start html <URL1> <URL2> \
  --exclude-attr-regex "*:id:^ad-" \
  --exclude-attr-regex "li:class:active"
```

## 결과물

-   **콘솔 출력:** 비교 결과(성공 또는 실패)가 콘솔에 출력됩니다.
-   **HTML 파일:** 비교에 사용된 정제된 HTML 구조가 `--out` 옵션으로 지정된 이름의 파일(기본값: `compare_a.html`, `compare_b.html`)로 생성됩니다. 구조가 다를 경우, 터미널에서 `diff` 명령어를 사용하여 두 파일의 차이점을 시각적으로 확인할 수 있습니다.

    ```bash
    diff compare_a.html compare_b.html
    ```
