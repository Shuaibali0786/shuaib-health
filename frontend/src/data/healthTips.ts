import type { ArticleBlock, HealthTip } from "@/types/content";

const heading = (text: string): ArticleBlock => ({ type: "heading", text });
const paragraph = (text: string): ArticleBlock => ({ type: "paragraph", text });
const list = (...items: string[]): ArticleBlock => ({ type: "list", items });

/**
 * Sample general-wellbeing articles. Generic lifestyle text only: no
 * diagnosis, dosage or treatment claims. Every card shows a "Sample" badge,
 * and every article page carries the "General information, not medical advice" note.
 * The article text lives in `body` blocks (heading, paragraph, list), 250-400 words each.
 * The first four keep their original dates, so Home's three newest tips are unchanged.
 */
export const healthTips: HealthTip[] = [
  {
    id: "tip-staying-hydrated",
    slug: "staying-hydrated",
    title: "Small habits for staying hydrated",
    summary: "Simple ideas to help you drink enough water through a busy day.",
    category: "Nutrition",
    publishedAt: "2026-09-12T09:00:00+05:00",
    image: {
      src: "/images/tips/staying-hydrated.jpg",
      alt: "Water being poured from a glass jug into a drinking glass",
      width: 800,
      height: 500,
    },
    body: [
      paragraph(
        "Water is part of almost everything your body does, yet a busy day makes it easy to forget to drink. The good news is that staying hydrated rarely needs a big change. A few small habits, repeated daily, usually do the job.",
      ),
      heading("Make water easy to reach"),
      paragraph(
        "People drink more when water is within arm's length. Keep a bottle or glass on your desk, in your bag and next to your bed. Filling it once in the morning and once at midday gives you a simple, visible target for the day.",
      ),
      heading("Link drinking to things you already do"),
      paragraph("Habits stick best when they are attached to something that already happens. For example:"),
      list(
        "Drink a glass of water when you wake up.",
        "Have a glass before each meal.",
        "Take a few sips every time you check your phone or finish a task.",
        "Finish a glass after brushing your teeth at night.",
      ),
      heading("Let your food help"),
      paragraph(
        "Many fruits and vegetables, such as cucumber, oranges and watermelon, contain a lot of water. Soups and lentil dishes add to your day as well. Tea and other drinks count too, though plain water is a good everyday choice.",
      ),
      heading("Notice your own signs"),
      paragraph(
        "Thirst is the obvious signal, but a dry mouth, a headache after a long day, or darker than usual urine can also be a hint to drink more. On hot days, or when you are active, you will usually want more than on a cool day at a desk.",
      ),
      heading("When to ask someone"),
      paragraph(
        "How much water suits you depends on your age, activity, the weather and your health. If you have a medical condition, or your doctor has given you advice about fluids, follow that advice rather than a general rule. A doctor is the right person to ask if you are unsure.",
      ),
      paragraph("Start with one change this week, such as a bottle on your desk, and add another when the first feels natural."),
    ],
    isSample: true,
  },
  {
    id: "tip-healthy-sleep-habits",
    slug: "healthy-sleep-habits",
    title: "A calmer routine for better sleep",
    summary: "A regular bedtime and a quiet, dim room can make winding down easier.",
    category: "Sleep",
    publishedAt: "2026-09-05T09:00:00+05:00",
    image: {
      src: "/images/tips/healthy-sleep-habits.jpg",
      alt: "Woman sleeping peacefully in a bed with light bedding",
      width: 800,
      height: 500,
    },
    body: [
      paragraph(
        "A good night's sleep is shaped as much by what happens in the hour before bed as by what happens in bed. A calm, predictable routine tells your body that the day is ending, and it costs nothing to try.",
      ),
      heading("Keep regular times"),
      paragraph(
        "Going to bed and getting up at roughly the same time each day, including weekends, helps your body settle into a rhythm. You do not have to be exact. Staying within an hour of your usual times is a good aim.",
      ),
      heading("Make the room restful"),
      paragraph("Your bedroom does not need to be fancy. A few simple adjustments are often enough:"),
      list(
        "Keep the room as dark as you can, or use a sleep mask.",
        "Keep it comfortably cool and well aired.",
        "Reduce noise, or use a steady background sound if silence is hard.",
        "Use the bed mainly for sleep, not for work.",
      ),
      heading("Wind down before bed"),
      paragraph(
        "Try to spend the last half hour before bed on something quiet: reading a few pages, gentle stretching, a warm shower or writing tomorrow's to-do list so it is out of your head. Dim the lights and put screens away if you can, because bright light late in the evening can make it harder to feel sleepy.",
      ),
      heading("Think about food and drink"),
      paragraph(
        "A heavy meal close to bedtime can be uncomfortable, and drinks with caffeine, such as tea, coffee and some fizzy drinks, can keep you alert for hours. Many people find it easier to have them earlier in the day.",
      ),
      heading("If sleep does not come"),
      paragraph(
        "Lying awake and watching the clock tends to make things worse. If you are still awake after a while, get up, sit somewhere quiet with a dim light, and return to bed when you feel sleepy.",
      ),
      paragraph(
        "If trouble sleeping goes on for weeks or affects your days, talk to a doctor. This article is general information and cannot tell you what is right for you.",
      ),
    ],
    isSample: true,
  },
  {
    id: "tip-balanced-plate",
    slug: "balanced-plate",
    title: "Building a balanced plate",
    summary: "A simple way to think about vegetables, protein and grains at each meal.",
    category: "Nutrition",
    publishedAt: "2026-08-28T09:00:00+05:00",
    image: {
      src: "/images/tips/balanced-plate.jpg",
      alt: "Plate with avocado, boiled egg, tomatoes, walnuts and leafy greens",
      width: 800,
      height: 500,
    },
    body: [
      paragraph(
        "You do not need to count anything to eat well. Picturing your plate in three parts is an easy way to make most meals more balanced, whether you are eating at home, at work or out.",
      ),
      heading("The three parts"),
      list(
        "About half the plate: vegetables and fruit. Think salad, cooked vegetables, a bowl of seasonal fruit on the side.",
        "About a quarter: protein, such as lentils, beans, chickpeas, eggs, fish, chicken or yoghurt.",
        "About a quarter: grains or starchy foods, such as roti, rice or potatoes. Whole grains, like whole wheat, are a good choice when you can.",
      ),
      heading("Add colour and variety"),
      paragraph(
        "Different coloured vegetables bring different nutrients, so try to include more than one colour in a day. Eating a range of foods across the week is more helpful than aiming for a perfect plate at every meal.",
      ),
      heading("Mind the extras"),
      paragraph(
        "Oil, ghee, sugar and salt add flavour, and a little goes a long way. Small changes, like using a bit less oil when cooking or choosing water instead of a sweet drink with a meal, add up over time.",
      ),
      heading("Eat at an easy pace"),
      paragraph(
        "Eating slowly, sitting down and putting your phone aside can help you notice when you are comfortably full. Smaller plates and sharing a dish are other simple ways to keep portions reasonable.",
      ),
      heading("Make it practical"),
      paragraph(
        "Planning two or three simple meals ahead, or chopping vegetables when you have time, makes the balanced option the easy one on a busy evening. Changes you can keep up are better than strict rules that last a week.",
      ),
      paragraph(
        "Everyone's needs are different. If you have a health condition, allergies or special dietary needs, ask your doctor or a dietitian what suits you. This article is general information, not personal advice.",
      ),
    ],
    isSample: true,
  },
  {
    id: "tip-daily-walk",
    slug: "daily-walk",
    title: "Adding a short daily walk",
    summary: "Ten minutes of walking is an easy way to add more movement to your day.",
    category: "Activity",
    publishedAt: "2026-08-14T09:00:00+05:00",
    image: {
      src: "/images/tips/daily-walk.jpg",
      alt: "Two people walking along a tree-lined park path in morning mist",
      width: 800,
      height: 500,
    },
    body: [
      paragraph(
        "Walking needs no equipment, no membership and no special skill. Many people find it the easiest way to move a little more, and a short walk fits into almost any day.",
      ),
      heading("Start small"),
      paragraph(
        "If you are not used to walking, begin with ten minutes at a comfortable pace. Once that feels easy, add a few minutes every week or two. Regular short walks are a better start than one long walk that leaves you tired and unwilling to repeat it.",
      ),
      heading("Find the moments that fit"),
      list(
        "Walk for ten minutes after a meal.",
        "Get off the bus one stop early, or park a little further away.",
        "Take a short walk during a break instead of sitting with your phone.",
        "Make a phone call while you walk around the room or garden.",
        "Invite a friend or family member, so you look forward to it.",
      ),
      heading("Make it comfortable"),
      paragraph(
        "Wear shoes that fit well and clothes that suit the weather. In the heat, choose the cooler hours of the morning or evening, carry water and walk in the shade where you can. A flat, well-lit route feels safer and easier.",
      ),
      heading("Listen to your body"),
      paragraph(
        "A little breathlessness is normal when you walk briskly, but you should still be able to talk. If you feel pain, dizziness or anything unusual, stop and rest. If you have a health condition, have been inactive for a long time, or are unsure how much activity is right for you, check with your doctor first.",
      ),
      heading("Keep it going"),
      paragraph(
        "Pick a regular time, tell someone your plan or keep a simple note of the days you walked. Do not worry about a missed day. Just start again the next morning.",
      ),
    ],
    isSample: true,
  },
  {
    id: "tip-hand-hygiene",
    slug: "hand-hygiene",
    title: "Handwashing: simple steps that matter",
    summary: "When and how to wash your hands so everyday habits keep you and others comfortable.",
    category: "Hygiene",
    publishedAt: "2026-08-07T09:00:00+05:00",
    image: {
      src: "/images/tips/hand-hygiene.jpg",
      alt: "Hands being washed with soap under a running tap",
      width: 800,
      height: 500,
    },
    body: [
      paragraph(
        "Washing your hands is one of the simplest everyday habits there is. It takes less than a minute, needs only soap and water, and is useful at home, at work and when you are out.",
      ),
      heading("When to wash"),
      list(
        "Before preparing or eating food.",
        "After using the toilet or changing a nappy.",
        "After coughing, sneezing or blowing your nose.",
        "After touching rubbish, animals or anything that looks dirty.",
        "After coming home from outside.",
        "Before and after caring for someone who is unwell.",
      ),
      heading("How to wash"),
      paragraph(
        "Wet your hands with clean running water and apply soap. Rub your palms together, then the backs of your hands, between your fingers, around your thumbs and under your nails. Keep going for about twenty seconds, which is roughly the time it takes to hum a short song twice. Rinse well and dry with a clean towel or let your hands air dry.",
      ),
      heading("When there is no sink"),
      paragraph(
        "If soap and water are not available, a hand sanitiser that contains alcohol can be used as a short-term option. Rub it over all the surfaces of your hands until they feel dry. If your hands look dirty or greasy, washing with soap and water is better.",
      ),
      heading("Looking after your skin"),
      paragraph(
        "Frequent washing can leave hands dry. Use lukewarm rather than very hot water, pat your hands dry and use a moisturiser if you need one. If your skin becomes sore or cracked, ask a doctor or pharmacist for advice.",
      ),
      heading("Help children build the habit"),
      paragraph(
        "Children copy what they see. Wash your hands together, make it a routine before meals, and keep soap and a clean towel where they can reach them.",
      ),
      paragraph("This article is general information about everyday habits and is not medical advice."),
    ],
    isSample: true,
  },
  {
    id: "tip-managing-stress",
    slug: "managing-stress",
    title: "Gentle ways to manage everyday stress",
    summary: "Small, practical habits for slowing down when the day feels too full.",
    category: "Mental wellbeing",
    publishedAt: "2026-07-31T09:00:00+05:00",
    image: {
      src: "/images/tips/managing-stress.jpg",
      alt: "Woman sitting calmly with her eyes closed against a plain wall, breathing slowly",
      width: 800,
      height: 500,
    },
    body: [
      paragraph(
        "Feeling stressed now and then is a normal part of life. Work, family, money and busy schedules can all pile up. While you cannot remove every pressure, a few small habits can help you feel steadier day to day.",
      ),
      heading("Pause and breathe"),
      paragraph(
        "When things feel rushed, stop for a minute. Sit comfortably, close your eyes if you like, and breathe in slowly through your nose for a count of four, then out through your mouth for a count of six. Repeat for a few minutes. Slow breathing is a simple way to give yourself a moment to settle.",
      ),
      heading("Move your body"),
      paragraph(
        "A short walk, some gentle stretching or a bit of fresh air can ease tension. You do not need a workout. Even five minutes away from your desk can help you come back with a clearer head.",
      ),
      heading("Keep to a rhythm"),
      list(
        "Try to sleep and wake at regular times.",
        "Eat regular meals and drink enough water.",
        "Take short breaks during long tasks.",
        "Set aside a little time each day for something you enjoy.",
      ),
      heading("Break things down"),
      paragraph(
        "A long list can feel overwhelming. Write down what needs doing, choose the one or two things that matter most today and let the rest wait. Saying no, or asking for help, is sometimes the kindest thing you can do for yourself.",
      ),
      heading("Stay connected"),
      paragraph(
        "Talking to a trusted friend or family member can lighten a worry. You do not have to solve everything alone, and often it helps simply to say it out loud.",
      ),
      heading("When to ask for help"),
      paragraph(
        "If stress or low mood lasts for weeks, makes it hard to cope with daily life, or leaves you feeling hopeless, please speak to a doctor or a mental health professional. If you ever feel you might harm yourself, contact local emergency services or someone you trust right away. This article is general information, not medical advice.",
      ),
    ],
    isSample: true,
  },
];
