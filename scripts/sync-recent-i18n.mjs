import fs from "fs";
import path from "path";

const messagesDir = path.join(process.cwd(), "messages");

const patches = {
  de: {
    chatPanel: {
      welcomeTitle: "Arbeitsbereich-Editor",
      welcomeDescription:
        "Sag mir, wie sich dieser Arbeitsbereich ändern soll. Ich kann Blöcke hinzufügen, Abschnitte entfernen, Kapitel neu ordnen oder Fokus und Schwierigkeit anpassen.",
    },
    sessionItem: {
      blockDetailGuideTitle: "Live-Denken, deine Materialien",
      blockDetailGuideIntro:
        "OpenLesson ist für live Denken und Argumentieren gebaut — nicht um Lehrbücher, Docs oder Kurse zu ersetzen. Helios prüft, was du verstehst, während du arbeitest; den Inhalt bringst du mit.",
      blockDetailGuideSourcesTitle: "Nutze deine eigenen Quellen",
      blockDetailGuideSourcesBody:
        "Verwende Grok, Grokipedia, Notizbücher oder beliebige Referenzen neben der Sitzung. Nachschlagen und Üben passieren außerhalb der Probe — die Sitzung erfasst, wie du mit dem Gefundenen argumentierst.",
      blockDetailGuideMaterialsTitle: "Passe den Arbeitsbereich an",
      blockDetailGuideMaterialsBody:
        "Hänge PDFs, Notizen und Bilder im Tab Dateien an und stimm jeden Block mit den benutzerdefinierten Anweisungen unten ab. Je mehr Kontext du hinzufügst, desto gezielter wird Helios.",
      blockDetailGuideHintsTitle: "OpenLesson optimal nutzen",
      blockDetailGuideHint1:
        "Tab Dateien — Referenzmaterial hinzufügen, damit Probes zu dem passen, was du wirklich lernst.",
      blockDetailGuideHint2:
        "Benutzerdefinierte Anweisungen — diesen Block auf Job, Prüfung oder Projekt ausrichten.",
      blockDetailGuideHint3:
        "ILE — laut denken, Sprache in Gedanken kristallisieren und sie während der Arbeit an Helios senden.",
      blockDetailGuideHint4:
        "Arbeitsbereich-Editor — Blöcke hinzufügen oder umgestalten, wenn du Lücken im Plan entdeckst.",
      blockDetailGuideHint5:
        "TAP — starten, wenn du bereit bist, Können zu demonstrieren, nicht beim ersten Durchlauf.",
    },
    planView: {
      performanceSubTabScore: "Bewertung",
      performanceSubTabTap: "TAP",
      performanceSubTabChat: "Chat",
      performanceSectionsAriaLabel: "Leistungsansichten",
      performanceScoreTitle: "Arbeitsbereich-Bewertung",
      performanceScoreHint:
        "Erzeuge eine Scorecard aus Sitzungen, TAP-Blöcken und hochgeladener Evidenz — derselbe Vertrag wie der Evidence-API-Performance-Report.",
      performanceScoreGenerate: "Bewertung erzeugen",
      performanceScoreGenerating: "Wird erzeugt…",
      performanceChatTitle: "Leistungs-Chat",
      startTap: "Think-Aloud-Protokoll starten",
      signInForTap: "Melde dich an, um eine TAP-Sitzung für diesen Arbeitsbereich zu starten.",
    },
    performanceChat: {
      welcomeDescription:
        "Frage mich alles über die Lernleistung in diesem Arbeitsbereich. Ich kann Blockberichte analysieren, Muster erkennen und Verbesserungsvorschläge geben.",
      noSessions: "Noch keine Blockdaten für diesen Arbeitsbereich.",
      starter1: "Zeig mir eine Rangliste bisher",
      starter2: "Wer verbessert sich am schnellsten?",
      starter3: "Bei welchen Knoten haben andere Schwierigkeiten?",
      starter4: "Was sollte die Gruppe als Nächstes üben?",
      starter5: "Vergleiche abgeschlossene und aktive Sitzungen",
      starter6: "Fasse die wichtigsten Leistungslücken zusammen",
    },
    performanceReportCard: {
      defaultLabel: "Leistungsbericht",
      tabOverview: "Überblick",
      tabCompetency: "Kompetenz",
      tabMarkers: "Marker",
      tabStrengths: "Stärken",
      tabGaps: "Lücken",
      tabNextSteps: "Nächste Schritte",
      tabHistory: "Verlauf",
      sectionsAriaLabel: "Scorecard-Bereiche",
      confidenceWellConnected: "Gut verknüpft",
      confidenceClear: "Klares Signal",
      confidenceDeveloping: "In Entwicklung",
      confidenceEmerging: "Aufkommend",
      learning: "Lernen",
      conversion: "Conversion",
      conversionGoal: "Conversion-Ziel",
      sourceWorkspace: "Arbeitsbereich",
      sourceInferred: "Abgeleitet",
      growthAreas: "Wachstumsbereiche",
      suggestions: "Vorschläge",
      competencyProfile: "Kompetenzprofil",
      competencyAriaLabel: "Leistungs-Kompetenzwerte",
      gapsEmpty:
        "In diesem Bericht wurden keine spezifischen Lücken identifiziert. Prüfe Stärken und nächste Schritte oder sammle mehr Evidenz.",
      repair: "Behebung",
      directionGoals: "Richtung & Zwischenziele",
      directionEmpty:
        "Noch keine übergeordnete Richtung erfasst. Erzeuge die Scorecard nach mehr Evidenz neu.",
      granularEvents: "Granulare Ereignisse & Aktionen",
      eventsEmpty:
        "Noch keine granularen Ereignisse. Füge Evidenz-Uploads, TAP-Sitzungen oder Checkpoints hinzu.",
      scoreEvolution: "Score-Entwicklung",
      historyCheck: "Check {check} · Tag {days} · {actionCount} {actionLabel}",
      historyActionOne: "Aktion",
      historyActionMany: "Aktionen",
      historyMetrics: "{gaps} Lücken · {goals} Ziele · {events} Ereignisse",
    },
    tap: {
      welcome: {
        greeting: "Hallo — ich bin {name}.",
        panelIntro:
          "Willkommen zum Think-Aloud-Protokoll. Das ist eine zeitgesteuerte Demonstration: Du erklärst, was du gelernt hast, während ich zuhöre, dann stelle ich sokratische Nachfragen, um Lücken und Stärken sichtbar zu machen.\n\nSo funktioniert es: Sprich dein Denken laut aus und kristallisiere es in Gedankenkarten. Sende einen Gedanken oder kombiniere mehrere — ich antworte unter meinem Avatar mit einer Frage nach der anderen, kein Chat-Thread. Deine Gedankenhistorie behält jede Spur, damit du sie erneut senden oder markieren kannst.\n\nSitzungsdauer und Tastenkürzel stehen rechts. Wenn die Zeit abläuft, erhältst du eine TAP-Bewertung mit Marker-Aufschlüsselung und Lückenanalyse.",
        callToAction:
          "Wenn du bereit bist, drücke Play. Der Timer startet und ich eröffne mit einer konkreten Frage zu dem, was du hier gelernt hast.",
        play: "Play",
        starting: "Wird gestartet…",
        skipTyping: "Tippen überspringen",
      },
    },
  },
  es: {
    chatPanel: {
      welcomeTitle: "Editor del espacio de trabajo",
      welcomeDescription:
        "Dime cómo quieres que cambie este espacio de trabajo. Puedo añadir bloques, eliminar secciones, reordenar capítulos o ajustar el enfoque y la dificultad.",
    },
    sessionItem: {
      blockDetailGuideTitle: "Pensamiento en vivo, tus materiales",
      blockDetailGuideIntro:
        "OpenLesson está pensado para el pensamiento y razonamiento en vivo — no para sustituir tus libros, documentos o cursos. Helios sondea lo que entiendes mientras trabajas; tú aportas el contenido.",
      blockDetailGuideSourcesTitle: "Consulta tus propias fuentes",
      blockDetailGuideSourcesBody:
        "Usa Grok, Grokipedia, cuadernos o cualquier referencia junto a la sesión. La búsqueda y la práctica quedan fuera de la sonda — la sesión captura cómo razonas con lo que encuentras.",
      blockDetailGuideMaterialsTitle: "Adapta el espacio de trabajo",
      blockDetailGuideMaterialsBody:
        "Adjunta PDFs, notas e imágenes en la pestaña Archivos y ajusta cada bloque con instrucciones personalizadas abajo. Cuanto más contexto añadas, más preciso será Helios.",
      blockDetailGuideHintsTitle: "Usa OpenLesson bien",
      blockDetailGuideHint1:
        "Pestaña Archivos — añade material de referencia para que las sondas coincidan con lo que realmente aprendes.",
      blockDetailGuideHint2:
        "Instrucciones personalizadas — orienta este bloque hacia tu trabajo, examen o proyecto.",
      blockDetailGuideHint3:
        "ILE — piensa en voz alta, cristaliza el habla en pensamientos y envíalos a Helios mientras trabajas.",
      blockDetailGuideHint4:
        "Editor del espacio — añade o remodela bloques cuando descubras huecos en el plan.",
      blockDetailGuideHint5:
        "TAP — ejecútalo cuando estés listo para demostrar habilidad, no en el primer intento.",
    },
    planView: {
      performanceSubTabScore: "Puntuación",
      performanceSubTabTap: "TAP",
      performanceSubTabChat: "Chat",
      performanceSectionsAriaLabel: "Vistas de rendimiento",
      performanceScoreTitle: "Puntuación del espacio",
      performanceScoreHint:
        "Genera una tarjeta de puntuación a partir de sesiones, bloques TAP y evidencia subida — el mismo contrato que el informe de rendimiento de Evidence API.",
      performanceScoreGenerate: "Generar puntuación",
      performanceScoreGenerating: "Generando…",
      performanceChatTitle: "Chat de rendimiento",
      startTap: "Iniciar Protocolo Think Aloud",
      signInForTap: "Inicia sesión para comenzar una sesión TAP en este espacio de trabajo.",
    },
    performanceChat: {
      welcomeDescription:
        "Pregúntame cualquier cosa sobre el rendimiento de aprendizaje en este espacio de trabajo. Puedo analizar informes de bloques, identificar patrones y ofrecer sugerencias de mejora.",
      noSessions: "Aún no hay datos de bloques para este espacio de trabajo.",
      starter1: "Dame una clasificación hasta ahora",
      starter2: "¿Quién está mejorando más rápido?",
      starter3: "¿En qué nodos tienen dificultades las personas?",
      starter4: "¿Qué debería practicar el grupo a continuación?",
      starter5: "Compara sesiones completadas vs activas",
      starter6: "Resume las principales lagunas de rendimiento",
    },
    performanceReportCard: {
      defaultLabel: "Informe de rendimiento",
      tabOverview: "Resumen",
      tabCompetency: "Competencia",
      tabMarkers: "Marcadores",
      tabStrengths: "Fortalezas",
      tabGaps: "Lagunas",
      tabNextSteps: "Próximos pasos",
      tabHistory: "Historial",
      sectionsAriaLabel: "Secciones de la tarjeta de puntuación",
      confidenceWellConnected: "Bien conectado",
      confidenceClear: "Señal clara",
      confidenceDeveloping: "En desarrollo",
      confidenceEmerging: "Emergente",
      learning: "Aprendizaje",
      conversion: "Conversión",
      conversionGoal: "Objetivo de conversión",
      sourceWorkspace: "Espacio de trabajo",
      sourceInferred: "Inferido",
      growthAreas: "Áreas de crecimiento",
      suggestions: "Sugerencias",
      competencyProfile: "Perfil de competencia",
      competencyAriaLabel: "Puntuaciones de competencia de rendimiento",
      gapsEmpty:
        "No se identificaron lagunas específicas en este informe. Revisa fortalezas y próximos pasos, o recopila más evidencia.",
      repair: "Reparación",
      directionGoals: "Dirección y objetivos intermedios",
      directionEmpty:
        "Aún no hay dirección de alto nivel. Regenera la tarjeta de puntuación tras más evidencia.",
      granularEvents: "Eventos y acciones granulares",
      eventsEmpty:
        "Aún no hay eventos granulares. Añade cargas de evidencia, sesiones TAP o puntos de control.",
      scoreEvolution: "Evolución de la puntuación",
      historyCheck: "Revisión {check} · día {days} · {actionCount} {actionLabel}",
      historyActionOne: "acción",
      historyActionMany: "acciones",
      historyMetrics: "{gaps} lagunas · {goals} objetivos · {events} eventos",
    },
    tap: {
      welcome: {
        greeting: "Hola — soy {name}.",
        panelIntro:
          "Bienvenido al Protocolo Think Aloud. Es una demostración cronometrada: explicas lo que aprendiste mientras escucho, luego hago seguimientos socráticos para revelar lagunas y fortalezas.\n\nCómo funciona: verbaliza tu razonamiento y conviértelo en tarjetas de pensamiento. Envía un pensamiento o combina varios — respondo bajo mi avatar con una pregunta cada vez, sin hilo de chat. Tu Memoria de pensamientos guarda cada rastro para reenviar o marcar.\n\nLa duración y los atajos de teclado están a la derecha. Cuando se acabe el tiempo, recibirás una puntuación TAP con desglose de marcadores y análisis de lagunas.",
        callToAction:
          "Cuando estés listo, pulsa Play. El temporizador empieza y abriré con una pregunta concreta sobre lo que aprendiste aquí.",
        play: "Play",
        starting: "Iniciando…",
        skipTyping: "Saltar escritura",
      },
    },
  },
  pl: {
    chatPanel: {
      welcomeTitle: "Edytor przestrzeni roboczej",
      welcomeDescription:
        "Powiedz, jak ta przestrzeń robocza ma się zmienić. Mogę dodać bloki, usunąć sekcje, zmienić kolejność rozdziałów lub dostosować fokus i trudność.",
    },
    sessionItem: {
      blockDetailGuideTitle: "Myślenie na żywo, twoje materiały",
      blockDetailGuideIntro:
        "OpenLesson służy myśleniu i rozumowaniu na żywo — nie zastępuje podręczników, dokumentów ani kursów. Helios bada to, co rozumiesz podczas pracy; treść dostarczasz ty.",
      blockDetailGuideSourcesTitle: "Korzystaj z własnych źródeł",
      blockDetailGuideSourcesBody:
        "Używaj Groka, Grokipedii, notatek lub dowolnych materiałów obok sesji. Wyszukiwanie i ćwiczenia są poza sondą — sesja rejestruje, jak rozumujesz z tym, co znajdujesz.",
      blockDetailGuideMaterialsTitle: "Dostosuj przestrzeń roboczą",
      blockDetailGuideMaterialsBody:
        "Dołącz PDF-y, notatki i obrazy w zakładce Pliki oraz dostosuj każdy blok poniższymi instrukcjami. Im więcej kontekstu dodasz, tym celniejszy będzie Helios.",
      blockDetailGuideHintsTitle: "Używaj OpenLesson dobrze",
      blockDetailGuideHint1:
        "Zakładka Pliki — dodaj materiały referencyjne, by sondy pasowały do tego, czego naprawdę się uczysz.",
      blockDetailGuideHint2:
        "Instrukcje własne — ukierunkuj ten blok na pracę, egzamin lub projekt.",
      blockDetailGuideHint3:
        "ILE — myśl na głos, krystalizuj mowę w myśli i wysyłaj je do Heliosa podczas pracy.",
      blockDetailGuideHint4:
        "Edytor przestrzeni — dodawaj lub zmieniaj bloki, gdy odkryjesz luki w planie.",
      blockDetailGuideHint5:
        "TAP — uruchom, gdy jesteś gotów zademonstrować umiejętność, nie przy pierwszym podejściu.",
    },
    planView: {
      performanceSubTabScore: "Wynik",
      performanceSubTabTap: "TAP",
      performanceSubTabChat: "Czat",
      performanceSectionsAriaLabel: "Widoki wydajności",
      performanceScoreTitle: "Wynik przestrzeni",
      performanceScoreHint:
        "Wygeneruj kartę wyników z sesji, bloków TAP i przesłanych dowodów — ten sam kontrakt co raport wydajności Evidence API.",
      performanceScoreGenerate: "Generuj wynik",
      performanceScoreGenerating: "Generowanie…",
      performanceChatTitle: "Czat wydajności",
      startTap: "Uruchom protokół Think Aloud",
      signInForTap: "Zaloguj się, aby rozpocząć sesję TAP w tej przestrzeni roboczej.",
    },
    performanceChat: {
      welcomeDescription:
        "Zapytaj mnie o wyniki nauki w tej przestrzeni roboczej. Mogę analizować raporty bloków, identyfikować wzorce i sugerować ulepszenia.",
      noSessions: "Brak danych bloków dla tej przestrzeni roboczej.",
      starter1: "Pokaż mi dotychczasową tablicę wyników",
      starter2: "Kto poprawia się najszybciej?",
      starter3: "Z którymi węzłami mają problemy uczestnicy?",
      starter4: "Co grupa powinna ćwiczyć dalej?",
      starter5: "Porównaj ukończone i aktywne sesje",
      starter6: "Podsumuj główne luki w wynikach",
    },
    performanceReportCard: {
      defaultLabel: "Raport wydajności",
      tabOverview: "Przegląd",
      tabCompetency: "Kompetencje",
      tabMarkers: "Markery",
      tabStrengths: "Mocne strony",
      tabGaps: "Luki",
      tabNextSteps: "Następne kroki",
      tabHistory: "Historia",
      sectionsAriaLabel: "Sekcje karty wyników",
      confidenceWellConnected: "Dobrze połączone",
      confidenceClear: "Wyraźny sygnał",
      confidenceDeveloping: "W rozwoju",
      confidenceEmerging: "Pojawiające się",
      learning: "Nauka",
      conversion: "Konwersja",
      conversionGoal: "Cel konwersji",
      sourceWorkspace: "Przestrzeń robocza",
      sourceInferred: "Wnioskowany",
      growthAreas: "Obszary rozwoju",
      suggestions: "Sugestie",
      competencyProfile: "Profil kompetencji",
      competencyAriaLabel: "Wyniki kompetencji wydajności",
      gapsEmpty:
        "W tym raporcie nie zidentyfikowano konkretnych luk. Sprawdź mocne strony i następne kroki lub zbierz więcej dowodów.",
      repair: "Naprawa",
      directionGoals: "Kierunek i cele pośrednie",
      directionEmpty:
        "Brak jeszcze kierunku wysokiego poziomu. Wygeneruj kartę wyników ponownie po zebraniu więcej dowodów.",
      granularEvents: "Szczegółowe zdarzenia i działania",
      eventsEmpty:
        "Brak jeszcze szczegółowych zdarzeń. Dodaj przesłane dowody, sesje TAP lub punkty kontrolne.",
      scoreEvolution: "Ewolucja wyniku",
      historyCheck: "Sprawdzenie {check} · dzień {days} · {actionCount} {actionLabel}",
      historyActionOne: "działanie",
      historyActionMany: "działań",
      historyMetrics: "{gaps} luk · {goals} celów · {events} zdarzeń",
    },
    tap: {
      welcome: {
        greeting: "Cześć — jestem {name}.",
        panelIntro:
          "Witaj w protokole Think Aloud. To czasowa demonstracja: wyjaśniasz, czego się nauczyłeś, a ja słucham, potem zadaję sokratejskie pytania uzupełniające, by ujawnić luki i mocne strony.\n\nJak to działa: mów swoje rozumowanie na głos i krystalizuj je w karty myśli. Wyślij jedną myśl lub połącz kilka — odpowiadam pod awatarem jednym pytaniem na raz, bez wątku czatu. Pamięć myśli zachowuje każdy ślad do ponownego wysłania lub oznaczenia.\n\nCzas sesji i skróty klawiszowe są po prawej. Gdy czas się skończy, otrzymasz wynik TAP z rozbiciem markerów i analizą luk.",
        callToAction:
          "Gdy będziesz gotowy, naciśnij Play. Timer wystartuje, a ja zacznę konkretnym pytaniem o to, czego się tu nauczyłeś.",
        play: "Play",
        starting: "Uruchamianie…",
        skipTyping: "Pomiń pisanie",
      },
    },
  },
  zh: {
    chatPanel: {
      welcomeTitle: "工作区构建器",
      welcomeDescription:
        "告诉我你希望这个工作区如何变化。我可以添加区块、删除部分、重新排序章节，或调整重点与难度。",
    },
    sessionItem: {
      blockDetailGuideTitle: "实时思考，你的资料",
      blockDetailGuideIntro:
        "OpenLesson 面向实时思考与推理——不是替代你的教材、文档或课程。Helios 在你工作时探测你的理解；内容由你带来。",
      blockDetailGuideSourcesTitle: "查阅你自己的资料",
      blockDetailGuideSourcesBody:
        "在会话旁使用 Grok、Grokipedia、笔记本或任何参考资料。查找与练习在探测之外——会话记录你如何运用所找到的内容进行推理。",
      blockDetailGuideMaterialsTitle: "定制工作区",
      blockDetailGuideMaterialsBody:
        "在“文件”标签页附加 PDF、笔记和图片，并在下方用自定义说明调整每个区块。你添加的上下文越多，Helios 就越精准。",
      blockDetailGuideHintsTitle: "更好地使用 OpenLesson",
      blockDetailGuideHint1: "文件标签页——添加参考资料，使探测与你实际学习的内容一致。",
      blockDetailGuideHint2: "自定义说明——将此区块导向你的工作、考试或项目。",
      blockDetailGuideHint3: "ILE——大声思考，将语音凝结为想法，并在工作中发送给 Helios。",
      blockDetailGuideHint4: "工作区构建器——发现计划中的缺口时添加或重塑区块。",
      blockDetailGuideHint5: "TAP——在你准备好展示技能时运行，而不是第一次尝试时。",
    },
    planView: {
      performanceSubTabScore: "评分",
      performanceSubTabTap: "TAP",
      performanceSubTabChat: "聊天",
      performanceSectionsAriaLabel: "表现视图",
      performanceScoreTitle: "工作区评分",
      performanceScoreHint:
        "根据会话、TAP 区块和上传的证据生成评分卡——与 Evidence API 性能报告相同的契约。",
      performanceScoreGenerate: "生成评分",
      performanceScoreGenerating: "生成中…",
      performanceChatTitle: "表现聊天",
      startTap: "开始 Think Aloud 协议",
      signInForTap: "登录以在此工作区开始 TAP 会话。",
    },
    performanceChat: {
      welcomeDescription:
        "向我询问此工作区学习表现的任何问题。我可以分析区块报告、识别模式并提供改进建议。",
      noSessions: "此工作区尚无区块数据。",
      starter1: "给我目前的排行榜",
      starter2: "谁进步最快？",
      starter3: "大家在哪些节点上遇到困难？",
      starter4: "小组接下来应该练习什么？",
      starter5: "比较已完成与进行中的会话",
      starter6: "总结主要的表现差距",
    },
    performanceReportCard: {
      defaultLabel: "表现报告",
      tabOverview: "概览",
      tabCompetency: "能力",
      tabMarkers: "指标",
      tabStrengths: "优势",
      tabGaps: "差距",
      tabNextSteps: "下一步",
      tabHistory: "历史",
      sectionsAriaLabel: "评分卡分区",
      confidenceWellConnected: "关联充分",
      confidenceClear: "信号清晰",
      confidenceDeveloping: "发展中",
      confidenceEmerging: "初现",
      learning: "学习",
      conversion: "转化",
      conversionGoal: "转化目标",
      sourceWorkspace: "工作区",
      sourceInferred: "推断",
      growthAreas: "成长领域",
      suggestions: "建议",
      competencyProfile: "能力概况",
      competencyAriaLabel: "表现能力评分",
      gapsEmpty: "本报告未识别出具体差距。请查看优势与下一步，或收集更多证据。",
      repair: "修复",
      directionGoals: "方向与中间目标",
      directionEmpty: "尚未记录高层方向。收集更多证据后重新生成评分卡。",
      granularEvents: "细粒度事件与行动",
      eventsEmpty: "尚无细粒度事件。添加证据上传、TAP 会话或检查点以填充可执行的下一步。",
      scoreEvolution: "评分演变",
      historyCheck: "检查 {check} · 第 {days} 天 · {actionCount} {actionLabel}",
      historyActionOne: "项行动",
      historyActionMany: "项行动",
      historyMetrics: "{gaps} 个差距 · {goals} 个目标 · {events} 个事件",
    },
    tap: {
      welcome: {
        greeting: "你好——我是 {name}。",
        panelIntro:
          "欢迎使用 Think Aloud 协议。这是一场限时演示：你说明所学内容，我倾听，然后通过苏格拉底式追问揭示差距与优势。\n\n运作方式：大声说出推理并凝结为想法卡片。发送一个想法或组合多个——我在头像下每次只回应一个问题，不是聊天线程。想法记忆保留每条轨迹，便于重发或标记。\n\n会话时长和键盘快捷键在右侧。时间结束后，你将收到包含指标分解与差距分析的 TAP 评分。",
        callToAction: "准备好后按 Play。计时开始，我会以关于你在此所学内容的具体问题开场。",
        play: "Play",
        starting: "启动中…",
        skipTyping: "跳过打字",
      },
    },
  },
  vi: {
    chatPanel: {
      welcomeTitle: "Trình tạo không gian làm việc",
      welcomeDescription:
        "Cho tôi biết bạn muốn thay đổi không gian làm việc này như thế nào. Tôi có thể thêm khối, xóa phần, sắp xếp lại chương hoặc điều chỉnh trọng tâm và độ khó.",
    },
    sessionItem: {
      blockDetailGuideTitle: "Tư duy trực tiếp, tài liệu của bạn",
      blockDetailGuideIntro:
        "OpenLesson được xây dựng cho tư duy và lập luận trực tiếp — không thay thế sách, tài liệu hay khóa học của bạn. Helios thăm dò những gì bạn hiểu khi bạn làm việc; bạn mang nội dung đến.",
      blockDetailGuideSourcesTitle: "Tham khảo nguồn của riêng bạn",
      blockDetailGuideSourcesBody:
        "Dùng Grok, Grokipedia, sổ ghi chép hoặc tài liệu tham khảo bên cạnh phiên. Tra cứu và luyện tập nằm ngoài thăm dò — phiên ghi lại cách bạn lập luận với những gì tìm được.",
      blockDetailGuideMaterialsTitle: "Tùy chỉnh không gian làm việc",
      blockDetailGuideMaterialsBody:
        "Đính kèm PDF, ghi chú và hình ảnh trong tab Tệp, và tinh chỉnh từng khối bằng hướng dẫn tùy chỉnh bên dưới. Càng nhiều ngữ cảnh, Helios càng nhắm đúng hơn.",
      blockDetailGuideHintsTitle: "Dùng OpenLesson hiệu quả",
      blockDetailGuideHint1:
        "Tab Tệp — thêm tài liệu tham khảo để thăm dò khớp với những gì bạn thực sự đang học.",
      blockDetailGuideHint2:
        "Hướng dẫn tùy chỉnh — định hướng khối này theo công việc, kỳ thi hoặc dự án của bạn.",
      blockDetailGuideHint3:
        "ILE — nghĩ thành tiếng, kết tinh lời nói thành ý tưởng và gửi cho Helios khi làm việc.",
      blockDetailGuideHint4:
        "Trình tạo không gian — thêm hoặc điều chỉnh khối khi phát hiện khoảng trống trong kế hoạch.",
      blockDetailGuideHint5:
        "TAP — chạy khi bạn sẵn sàng chứng minh kỹ năng, không phải lần đầu.",
    },
    planView: {
      performanceSubTabScore: "Điểm",
      performanceSubTabTap: "TAP",
      performanceSubTabChat: "Trò chuyện",
      performanceSectionsAriaLabel: "Các chế độ xem hiệu suất",
      performanceScoreTitle: "Điểm không gian làm việc",
      performanceScoreHint:
        "Tạo thẻ điểm từ phiên, khối TAP và bằng chứng đã tải lên — cùng hợp đồng với báo cáo hiệu suất Evidence API.",
      performanceScoreGenerate: "Tạo điểm",
      performanceScoreGenerating: "Đang tạo…",
      performanceChatTitle: "Trò chuyện hiệu suất",
      startTap: "Bắt đầu Giao thức Think Aloud",
      signInForTap: "Đăng nhập để bắt đầu phiên TAP cho không gian làm việc này.",
    },
    performanceChat: {
      signInRequired: "Đăng nhập để xem thông tin hiệu suất",
      welcomeTitle: "Thông tin hiệu suất",
      welcomeDescription:
        "Hỏi tôi bất cứ điều gì về hiệu suất học tập trong không gian làm việc này. Tôi có thể phân tích báo cáo khối, nhận diện mẫu và đưa ra gợi ý cải thiện.",
      exampleQuestions: "Thử hỏi:",
      example1: "Tôi đang làm tổng thể thế nào?",
      example2: "Chủ đề nào cần luyện tập thêm?",
      example3: "Cho tôi xem tiến bộ theo thời gian",
      placeholder: "Hỏi về hiệu suất...",
      errorMessage: "Xin lỗi, tôi không thể xử lý yêu cầu của bạn. Vui lòng thử lại.",
      noSessions: "Chưa có dữ liệu khối cho không gian làm việc này.",
      starter1: "Cho tôi bảng xếp hạng hiện tại",
      starter2: "Ai đang cải thiện nhanh nhất?",
      starter3: "Mọi người đang gặp khó ở những nút nào?",
      starter4: "Nhóm nên luyện tập gì tiếp theo?",
      starter5: "So sánh phiên đã hoàn thành và đang hoạt động",
      starter6: "Tóm tắt các khoảng trống hiệu suất chính",
    },
    performanceReportCard: {
      defaultLabel: "Báo cáo hiệu suất",
      tabOverview: "Tổng quan",
      tabCompetency: "Năng lực",
      tabMarkers: "Chỉ số",
      tabStrengths: "Điểm mạnh",
      tabGaps: "Khoảng trống",
      tabNextSteps: "Bước tiếp theo",
      tabHistory: "Lịch sử",
      sectionsAriaLabel: "Các phần thẻ điểm",
      confidenceWellConnected: "Kết nối tốt",
      confidenceClear: "Tín hiệu rõ",
      confidenceDeveloping: "Đang phát triển",
      confidenceEmerging: "Mới nổi",
      learning: "Học tập",
      conversion: "Chuyển đổi",
      conversionGoal: "Mục tiêu chuyển đổi",
      sourceWorkspace: "Không gian làm việc",
      sourceInferred: "Suy luận",
      growthAreas: "Lĩnh vực phát triển",
      suggestions: "Gợi ý",
      competencyProfile: "Hồ sơ năng lực",
      competencyAriaLabel: "Điểm năng lực hiệu suất",
      gapsEmpty:
        "Không xác định khoảng trống cụ thể trong báo cáo này. Xem điểm mạnh và bước tiếp theo, hoặc thu thập thêm bằng chứng.",
      repair: "Khắc phục",
      directionGoals: "Hướng đi & mục tiêu trung gian",
      directionEmpty:
        "Chưa ghi nhận hướng đi cấp cao. Tạo lại thẻ điểm sau khi có thêm bằng chứng.",
      granularEvents: "Sự kiện & hành động chi tiết",
      eventsEmpty:
        "Chưa có sự kiện chi tiết. Thêm tải bằng chứng, phiên TAP hoặc điểm kiểm tra.",
      scoreEvolution: "Tiến trình điểm",
      historyCheck: "Kiểm tra {check} · ngày {days} · {actionCount} {actionLabel}",
      historyActionOne: "hành động",
      historyActionMany: "hành động",
      historyMetrics: "{gaps} khoảng trống · {goals} mục tiêu · {events} sự kiện",
    },
    tap: {
      welcome: {
        greeting: "Xin chào — tôi là {name}.",
        panelIntro:
          "Chào mừng đến Giao thức Think Aloud. Đây là buổi trình diễn có giới hạn thời gian: bạn giải thích những gì đã học trong khi tôi lắng nghe, sau đó tôi đặt câu hỏi Socratic để lộ khoảng trống và điểm mạnh.\n\nCách hoạt động: nói suy nghĩ thành tiếng và kết tinh thành thẻ ý tưởng. Gửi một ý tưởng hoặc kết hợp nhiều ý — tôi trả lời dưới avatar với một câu hỏi mỗi lần, không phải luồng chat. Bộ nhớ ý tưởng giữ mọi dấu vết để gửi lại hoặc đánh dấu.\n\nThời lượng phiên và phím tắt ở bên phải. Khi hết giờ, bạn nhận điểm TAP với phân tích marker và khoảng trống.",
        callToAction:
          "Khi sẵn sàng, nhấn Play. Bộ đếm thời gian bắt đầu và tôi sẽ mở bằng câu hỏi cụ thể về những gì bạn học ở đây.",
        play: "Play",
        starting: "Đang bắt đầu…",
        skipTyping: "Bỏ qua gõ chữ",
      },
    },
  },
};

function deepMerge(target, source) {
  for (const [key, value] of Object.entries(source)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      if (!target[key] || typeof target[key] !== "object") target[key] = {};
      deepMerge(target[key], value);
    } else {
      target[key] = value;
    }
  }
  return target;
}

for (const [locale, patch] of Object.entries(patches)) {
  const filePath = path.join(messagesDir, `${locale}.json`);
  const json = JSON.parse(fs.readFileSync(filePath, "utf8"));
  deepMerge(json, patch);
  fs.writeFileSync(filePath, `${JSON.stringify(json, null, 2)}\n`, "utf8");
  console.log(`Updated ${locale}.json`);
}