export type BookableService = {
  id: string;
  category: "wellness" | "medicine";
  title: string;
  description: string;
  body: string;
  highlights: { title: string; description: string }[];
  durations: string[];
  price: string;
  priceCenter?: string;
  priceSuite?: string;
  image: string;
};

export const bookableServices: BookableService[] = [
  {
    id: "espira",
    category: "wellness",
    title: "Espira",
    description:
      "Ritual breve que libera tensiones en espalda, cuello y hombros. Técnicas envolventes, presión consciente y aceites esenciales.",
    body: "Espira es un ritual express diseñado para quienes necesitan desconectar en poco tiempo. En 30 minutos, nuestro terapeuta trabaja de forma precisa sobre la zona dorsal alta, el cuello y los hombros — las áreas donde se acumula la tensión del día a día. Se combinan maniobras de deslizamiento profundo con presión puntual sobre los nudos de tensión, utilizando aceites esenciales seleccionados por sus propiedades relajantes y descontracturantes. Es el punto de partida ideal si nunca has recibido un masaje terapéutico o si buscas un momento de pausa durante la semana.",
    highlights: [
      {
        title: "Alivio inmediato",
        description:
          "Actúa directamente sobre los focos de tensión del cuello y los trapecios, con resultados perceptibles desde la primera sesión.",
      },
      {
        title: "Aceites esenciales terapéuticos",
        description:
          "La combinación de aromaterapia y tacto activa el sistema nervioso parasimpático, induciendo calma en pocos minutos.",
      },
      {
        title: "Formato express sin compromiso",
        description:
          "30 minutos de eficacia concentrada. Perfecto para combinar con otras experiencias del centro o como ritual de bienestar semanal.",
      },
    ],
    durations: ["30 min"],
    price: "90 €",
    priceCenter: "90 €",
    priceSuite: "120 €",
    image: "/images/menu/manual-therapies.webp",
  },
  {
    id: "pulse",
    category: "wellness",
    title: "Pulse",
    description:
      "Masaje descontracturante de presión profunda para zonas de dolor, rigidez y sobrecarga muscular.",
    body: "Pulse está diseñado para el cuerpo que trabaja duro. Con una duración de 45 minutos y una presión superior a la media, este masaje aborda las contracturas musculares instaladas, la rigidez postural y los focos de dolor que no ceden con el descanso habitual. Nuestro terapeuta identifica en cada sesión las zonas de mayor carga y aplica técnicas de fricción profunda, compresión isquémica y movilización pasiva para restablecer el tono muscular óptimo. Especialmente recomendado para personas con trabajos sedentarios, deportistas en periodos de carga alta o quienes han acumulado tensión crónica.",
    highlights: [
      {
        title: "Presión profunda controlada",
        description:
          "Técnica de tejido profundo que alcanza capas musculares que el masaje convencional no trata, deshaciendo contracturas reales.",
      },
      {
        title: "Evaluación en cada sesión",
        description:
          "El terapeuta adapta la presión y las zonas de trabajo según tu estado en el momento, no siguiendo un protocolo fijo.",
      },
      {
        title: "Recuperación acelerada",
        description:
          "Reduce el tiempo de recuperación muscular, mejora la circulación local y alivia la tensión nerviosa asociada a las contracturas.",
      },
    ],
    durations: ["45 min"],
    price: "100 €",
    priceCenter: "100 €",
    priceSuite: "130 €",
    image: "/images/menu/manual-therapies.webp",
  },
  {
    id: "drenaje-linfatico",
    category: "wellness",
    title: "Drenaje Linfático Brasileño",
    description:
      "Masaje estético y terapéutico para moldear la silueta, reducir retención de líquidos y mejorar la piel de naranja.",
    body: "El Drenaje Linfático Brasileño es una técnica de origen brasileño que combina el drenaje linfático manual clásico con maniobras modeladoras específicas. A través de movimientos rítmicos y direccionados, se estimula el flujo linfático superficial, facilitando la eliminación de líquidos retenidos y toxinas. El resultado es una figura más definida, piel más tersa y una sensación de ligereza inmediata. Es especialmente efectivo cuando se realiza en ciclos de sesiones periódicas, ya que los efectos son acumulativos. Indicado para personas con retención de líquidos, celulitis, hinchazón en piernas o como complemento a un proceso de cambio corporal.",
    highlights: [
      {
        title: "Reducción de retención de líquidos",
        description:
          "Estimula el sistema linfático para drenar el exceso de líquido intersticial, reduciendo la hinchazón de forma visible.",
      },
      {
        title: "Efecto modelador",
        description:
          "Las maniobras brasileñas trabajan sobre la capa hipodérmica para suavizar la piel de naranja y mejorar el contorno corporal.",
      },
      {
        title: "Mejora circulatoria",
        description:
          "Activa la microcirculación y el retorno venoso, aliviando la pesadez de piernas y mejorando la oxigenación tisular.",
      },
    ],
    durations: ["50 min"],
    price: "100 €",
    priceCenter: "100 €",
    priceSuite: "130 €",
    image: "/images/menu/manual-therapies.webp",
  },
  {
    id: "essentia-active",
    category: "wellness",
    title: "Essentia Active",
    description:
      "Masaje para piernas y músculos fatigados. Ideal para deportistas y personas activas: reduce fatiga, previene lesiones.",
    body: "Essentia Active es el protocolo de recuperación diseñado para el cuerpo en movimiento. Combina técnicas de masaje deportivo, compresión neuromuscular y estiramientos asistidos para acelerar la recuperación muscular, reducir la fatiga acumulada y mantener la funcionalidad del tejido entre entrenamientos. El trabajo se centra especialmente en las cadenas musculares de las extremidades inferiores — cuádriceps, isquiotibiales, gemelos y glúteos — sin descuidar la zona lumbar y los flexores de cadera. Ideal antes y después de eventos deportivos, o como mantenimiento semanal para quienes entrenan con regularidad.",
    highlights: [
      {
        title: "Recuperación muscular activa",
        description:
          "Técnicas específicas para reducir el DOMS (dolor muscular de aparición tardía) y acelerar la vuelta a la actividad.",
      },
      {
        title: "Prevención de lesiones",
        description:
          "Detecta y trata zonas de sobrecarga antes de que se conviertan en lesiones, manteniendo la calidad del tejido muscular.",
      },
      {
        title: "Movilidad articular mejorada",
        description:
          "Los estiramientos asistidos al final de la sesión restauran la longitud muscular y la amplitud de movimiento articular.",
      },
    ],
    durations: ["45 min"],
    price: "110 €",
    priceCenter: "110 €",
    priceSuite: "140 €",
    image: "/images/menu/manual-therapies.webp",
  },
  {
    id: "nurtura",
    category: "wellness",
    title: "Nurtura",
    description:
      "Masaje diseñado para futuras mamás. Técnicas suaves y seguras que alivian tensión muscular e hinchazón durante el embarazo.",
    body: "Nurtura es un masaje prenatal diseñado específicamente para acompañar el cuerpo durante el embarazo. Con posicionamiento adecuado y técnicas de presión suave, alivia los dolores lumbares y dorsales propios de la gestación, reduce la hinchazón en extremidades y proporciona un espacio de calma profunda tanto para la madre como para el bebé. Todas las maniobras están adaptadas al segundo y tercer trimestre, evitando zonas contraindicadas y utilizando aceites vegetales seguros para la piel sensible durante el embarazo. Una experiencia que cuida desde el tacto.",
    highlights: [
      {
        title: "Alivio del dolor lumbar",
        description:
          "Trabaja sobre los músculos paravertebrales y el sacro, que soportan una carga creciente a medida que avanza el embarazo.",
      },
      {
        title: "Reducción del edema",
        description:
          "Maniobras suaves de drenaje en piernas y tobillos para aliviar la retención de líquidos propia del tercer trimestre.",
      },
      {
        title: "Calma profunda compartida",
        description:
          "La reducción del cortisol materno tiene un efecto directo sobre el bienestar del bebé, convirtiendo la sesión en un momento de conexión.",
      },
    ],
    durations: ["50 min"],
    price: "130 €",
    priceCenter: "130 €",
    priceSuite: "160 €",
    image: "/images/menu/manual-therapies.webp",
  },
  {
    id: "serenna",
    category: "wellness",
    title: "Serenna",
    description:
      "Experiencia de relajación profunda con maniobras suaves y continuas. Estimula la circulación y revitaliza la energía desde el interior.",
    body: "Serenna es un masaje de relajación total que combina maniobras largas y envolventes con trabajo circulatorio y estimulación del sistema nervioso parasimpático. La sesión comienza con una respiración guiada para facilitar la entrega al descanso, seguida de un recorrido completo por todo el cuerpo con aceites tibios y movimientos rítmicos que imitan el fluir del agua. No hay puntos de presión intensa ni trabajo profundo — el objetivo es desconectar completamente, bajar el ritmo y salir renovado. Es la elección perfecta para quienes viven con el sistema nervioso simpático permanentemente activado.",
    highlights: [
      {
        title: "Desactivación del sistema nervioso",
        description:
          "Las maniobras lentas y continuas envían señales de seguridad al sistema nervioso, bajando la frecuencia cardíaca y el cortisol.",
      },
      {
        title: "Circulación y calor",
        description:
          "El trabajo de effleurage con aceites tibios mejora la circulación superficial y deja la piel nutrida y luminosa.",
      },
      {
        title: "Recuperación del sueño",
        description:
          "Muchos clientes reportan una mejora notable en la calidad del sueño en los días posteriores a una sesión de Serenna.",
      },
    ],
    durations: ["50 min"],
    price: "130 €",
    priceCenter: "130 €",
    priceSuite: "160 €",
    image: "/images/menu/manual-therapies.webp",
  },
  {
    id: "solea",
    category: "wellness",
    title: "Soléa",
    description:
      "Para pieles expuestas al sol. Envoltura de aloe vera antiinflamatoria más masaje relajante de cuerpo completo.",
    body: "Soléa es el tratamiento esencial para recuperar la piel después de la exposición solar. La sesión comienza con una envoltura de aloe vera puro con acción antiinflamatoria y calmante, que se aplica en caliente sobre toda la superficie corporal para aliviar el eritema, hidratar en profundidad y restaurar la barrera cutánea. Tras un tiempo de absorción, el terapeuta realiza un masaje de cuerpo completo con movimientos suaves y deslizantes que potencian la penetración de los activos y trabajan la musculatura superficial. La piel sale hidratada, calmada y visiblemente más uniforme.",
    highlights: [
      {
        title: "Envoltura de aloe vera activo",
        description:
          "El aloe vera concentrado calma la inflamación, frena la descamación y acelera la regeneración celular de la piel dañada por el sol.",
      },
      {
        title: "Hidratación profunda",
        description:
          "La combinación de calor y activos naturales abre los poros y permite una absorción máxima de la hidratación en la dermis.",
      },
      {
        title: "Masaje cuerpo completo incluido",
        description:
          "No es solo un tratamiento estético: el masaje posterior trabaja la musculatura y el sistema nervioso para una recuperación integral.",
      },
    ],
    durations: ["70 min"],
    price: "150 €",
    priceCenter: "150 €",
    priceSuite: "180 €",
    image: "/images/menu/manual-therapies.webp",
  },
  {
    id: "soma",
    category: "wellness",
    title: "Soma",
    description:
      "Masaje de tejido profundo para contracturas, rigidez y dolores persistentes. Mejora movilidad y elasticidad muscular.",
    body: "Soma es el protocolo más intensivo de nuestra carta de masajes. En 60 minutos, el terapeuta trabaja sistemáticamente sobre las capas musculares profundas, las fascias restrictivas y los puntos gatillo que generan dolor referido. Se utilizan técnicas de tejido profundo, liberación miofascial y movilización articular para restablecer la movilidad perdida, disolver las adherencias tisulares y calmar los patrones de dolor crónico. El trabajo es deliberado y preciso: cada maniobra tiene un objetivo claro. Recomendado para personas con dolor cervical crónico, lumbalgias recurrentes, síndrome del trapecio o restricciones de movimiento post-lesión.",
    highlights: [
      {
        title: "Liberación miofascial profunda",
        description:
          "Trabaja sobre la fascia muscular para eliminar adherencias que limitan el movimiento y perpetúan los patrones de dolor.",
      },
      {
        title: "Puntos gatillo activos",
        description:
          "La compresión isquémica sobre los trigger points desactiva los focos de dolor referido, normalizando el tono muscular.",
      },
      {
        title: "Movilización articular",
        description:
          "Las técnicas de movilización pasiva recuperan los movimientos accesorios de las articulaciones que se pierden tras una lesión o inmovilización.",
      },
    ],
    durations: ["60 min"],
    price: "160 €",
    priceCenter: "160 €",
    priceSuite: "190 €",
    image: "/images/menu/manual-therapies.webp",
  },
  {
    id: "lume",
    category: "wellness",
    title: "Lume",
    description:
      "Experiencia multisensorial: masaje cráneo-facial, reflexología y aromaterapia para una desconexión total.",
    body: "Lume es nuestra experiencia multisensorial más completa. En 80 minutos, se integran tres disciplinas en un flujo continuo sin interrupciones: masaje craneofacial para liberar la tensión acumulada en la cabeza, cuero cabelludo, mandíbula y cuello; reflexología podal para estimular los órganos internos a través de los puntos reflejos del pie; y aromaterapia personalizada con aceites esenciales seleccionados según el estado emocional del cliente antes de la sesión. El resultado es una desconexión total del sistema nervioso que va más allá del simple relajamiento muscular — Lume trabaja sobre el sistema nervioso autónomo, el estado mental y la percepción corporal.",
    highlights: [
      {
        title: "Masaje craneofacial",
        description:
          "Libera la tensión de la mandíbula, los temporales, el cuero cabelludo y el cuello — zonas donde se almacena el estrés emocional.",
      },
      {
        title: "Reflexología podal",
        description:
          "Estimula los puntos reflejos de los órganos en la planta del pie, equilibrando el funcionamiento de los sistemas internos.",
      },
      {
        title: "Aromaterapia personalizada",
        description:
          "Los aceites esenciales se seleccionan en consulta previa según el objetivo de la sesión: descanso, claridad mental o equilibrio emocional.",
      },
    ],
    durations: ["80 min"],
    price: "220 €",
    priceCenter: "220 €",
    priceSuite: "250 €",
    image: "/images/menu/manual-therapies.webp",
  },
  {
    id: "alure-duo",
    category: "wellness",
    title: "Alure Duo",
    description:
      "Ritual sensorial para dos personas: reconexión a través del tacto, la respiración y el cuidado mutuo.",
    body: "Alure Duo es una experiencia diseñada para dos personas que desean compartir un espacio de bienestar y reconexión. Dos terapeutas trabajan de forma sincronizada en una sala privada con ambiente especialmente preparado — iluminación suave, música ambiental en directo y aromaterapia de sala. La sesión combina técnicas de masaje relajante en pareja con ejercicios de respiración sincronizada y momentos de contacto consciente guiado. Es una experiencia para parejas, amigos o familiares que quieren compartir un momento de calidad fuera de la rutina. No requiere ninguna experiencia previa en bienestar.",
    highlights: [
      {
        title: "Dos terapeutas sincronizados",
        description:
          "El trabajo en pareja, con dos profesionales coordinados, crea una experiencia de mayor profundidad e inmersión sensorial.",
      },
      {
        title: "Sala privada preparada",
        description:
          "Ambiente íntimo con iluminación, aromaterapia y música diseñados específicamente para la experiencia compartida.",
      },
      {
        title: "Reconexión a través del tacto",
        description:
          "Los ejercicios de contacto consciente guiado fomentan la presencia mutua y el vínculo emocional entre los participantes.",
      },
    ],
    durations: ["50 min"],
    price: "270 €",
    priceCenter: "270 €",
    image: "/images/menu/manual-therapies.webp",
  },
  {
    id: "essentia-signature",
    category: "wellness",
    title: "Essentia",
    description:
      "Experiencia completa: peeling corporal, envoltura ultra hidratante, facial rejuvenecedor con masaje craneofacial y masaje de cuerpo completo.",
    body: "Essentia es nuestra experiencia signature: el protocolo más completo que ofrecemos, diseñado para una transformación total de cuerpo, piel y estado mental en 120 minutos. La sesión comienza con un peeling corporal de sales minerales para eliminar las células muertas y preparar la piel. A continuación, se aplica una envoltura de manteca y aceites ultra hidratantes que se absorbe durante el siguiente paso: un masaje facial rejuvenecedor con masaje craneofacial que trabaja sobre la expresión facial, la circulación cutánea y la tensión del cráneo. La sesión concluye con un masaje de cuerpo completo de intensidad media que integra todo el trabajo anterior en una experiencia cohesionada. Exclusivo para el centro — no disponible en habitación.",
    highlights: [
      {
        title: "Protocolo de 4 fases",
        description:
          "Peeling, envoltura, facial y masaje corporal se suceden de forma fluida, cada fase potenciando los efectos de la siguiente.",
      },
      {
        title: "Transformación cutánea completa",
        description:
          "La piel sale exfoliada, hidratada en profundidad y luminosa. Los efectos son visibles inmediatamente y duran varios días.",
      },
      {
        title: "Integración cuerpo-mente",
        description:
          "El masaje craneofacial al final del protocolo integra la experiencia en el sistema nervioso, dejando una sensación de completud y calma duradera.",
      },
    ],
    durations: ["120 min"],
    price: "350 €",
    priceCenter: "350 €",
    image: "/images/menu/manual-therapies.webp",
  },
];
