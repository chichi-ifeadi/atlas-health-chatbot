-- Atlas Knowledge Base Seed
-- 30 wellness entries drawn from WHO, CDC, and Mayo Clinic guidance.
-- Topics: sleep hygiene, stress management, nutrition, hydration, exercise, mental health self-care.
-- Run after init.sql. safe to re-run: unique titles prevent duplicates if you add ON CONFLICT later.

INSERT INTO kb_documents (title, content, tags) VALUES

-- ============================================================
-- SLEEP HYGIENE (1–5)
-- ============================================================

(
  'Sleep Hygiene: Consistent Sleep Schedule',
  'The CDC recommends adults get 7 or more hours of sleep per night. Going to bed and waking at the same time every day — including weekends — reinforces the body''s circadian rhythm, making it easier to fall asleep and wake naturally. Irregular schedules are linked to poorer sleep quality, daytime fatigue, and increased metabolic risk. A fixed alarm time is more important than a fixed bedtime when starting out.',
  ARRAY['sleep', 'circadian', 'schedule', 'cdc']
),

(
  'Sleep Environment: Temperature, Light, and Noise',
  'Mayo Clinic recommends keeping the bedroom cool, dark, and quiet. An ideal room temperature is 60–67°F (15–19°C). Blackout curtains reduce light exposure; white noise or earplugs reduce sound disruption. Reserve the bed for sleep and intimacy only — working or watching screens in bed weakens the mental link between bed and sleep, making it harder to fall asleep over time.',
  ARRAY['sleep', 'environment', 'bedroom', 'mayo-clinic']
),

(
  'Blue Light and Screen Use Before Bed',
  'Blue light from phones, tablets, and televisions suppresses melatonin production and delays sleep onset. The CDC recommends avoiding screens for at least one hour before bedtime. Enabling night mode reduces but does not eliminate this effect. Reading a physical book, light stretching, or listening to calm audio are effective screen-free alternatives for the pre-sleep period.',
  ARRAY['sleep', 'blue-light', 'screens', 'melatonin', 'cdc']
),

(
  'Caffeine Timing and Sleep Quality',
  'Caffeine has a half-life of roughly 5–6 hours in the body. Mayo Clinic advises avoiding caffeine after 2 PM to minimise sleep disruption. Sources include coffee, tea, cola, energy drinks, and some pain relievers. Even moderate afternoon caffeine intake increases the time it takes to fall asleep and reduces the amount of deep sleep obtained during the night.',
  ARRAY['sleep', 'caffeine', 'stimulants', 'mayo-clinic']
),

(
  'Pre-Sleep Relaxation Routine',
  'A consistent calming routine in the 30–60 minutes before bed signals the brain to transition toward sleep. WHO-endorsed techniques include progressive muscle relaxation, slow diaphragmatic breathing, a warm bath or shower 1–2 hours before bed, and light reading. Avoid intense exercise, emotionally stimulating content, or large meals within two hours of your target bedtime.',
  ARRAY['sleep', 'relaxation', 'routine', 'who']
),

-- ============================================================
-- STRESS MANAGEMENT (6–10)
-- ============================================================

(
  'Understanding the Stress Response',
  'The WHO defines stress as mental tension caused by difficult situations. The body''s stress response releases cortisol and adrenaline, raising heart rate and blood pressure. Short-term stress is normal and adaptive. Chronic unmanaged stress contributes to headaches, disrupted sleep, weakened immunity, and increased risk of cardiovascular disease and depression.',
  ARRAY['stress', 'cortisol', 'chronic-stress', 'who']
),

(
  'Diaphragmatic Breathing for Immediate Stress Relief',
  'Deep breathing activates the parasympathetic nervous system, reducing cortisol and lowering heart rate. Mayo Clinic recommends the 4-7-8 technique: inhale for 4 counts, hold for 7, exhale slowly for 8. Practising for 5–10 minutes daily produces measurable reductions in resting anxiety. The technique works immediately during a stressful moment and requires no equipment.',
  ARRAY['stress', 'breathing', 'anxiety', 'relaxation', 'mayo-clinic']
),

(
  'Physical Activity as a Stress Buffer',
  'The CDC reports that exercise reduces the body''s stress hormones — including cortisol and adrenaline — while stimulating endorphin release. A 30-minute brisk walk provides immediate mood benefits. People who exercise regularly show greater psychological resilience to stressors. Consistent moderate activity throughout the week is more effective for stress management than occasional intense sessions.',
  ARRAY['stress', 'exercise', 'endorphins', 'mood', 'cdc']
),

(
  'Time Management to Reduce Chronic Stress',
  'The WHO identifies poor time management as a leading source of workplace and personal stress. Effective strategies include breaking large tasks into smaller steps, using an urgency-importance matrix to prioritise, protecting focused work blocks, and scheduling regular short breaks. Declining non-essential commitments and communicating realistic timelines also reduce baseline stress levels significantly.',
  ARRAY['stress', 'time-management', 'productivity', 'burnout', 'who']
),

(
  'Social Connection and Stress Resilience',
  'Strong social connections buffer the physiological effects of stress. The CDC highlights that people with robust social support show lower cortisol responses to stressors and recover more quickly from stressful events. Regular contact with trusted friends or family — even brief daily check-ins — meaningfully reduces perceived stress and supports healthier emotional regulation.',
  ARRAY['stress', 'social-support', 'resilience', 'community', 'cdc']
),

-- ============================================================
-- NUTRITION (11–15)
-- ============================================================

(
  'Balanced Diet Foundations for Daily Wellness',
  'The WHO recommends a diet built on fruits, vegetables, legumes, nuts, and whole grains, with at least 400 g of fruits and vegetables per day. Limiting free sugars to under 10% of total calories and saturated fats to under 10% supports heart health. Ultra-processed foods high in salt, added sugar, and refined carbohydrates are associated with increased risk of chronic disease.',
  ARRAY['nutrition', 'diet', 'vegetables', 'who']
),

(
  'Sustaining Energy Through Balanced Meals',
  'Mayo Clinic advises spreading intake across three balanced meals and one or two small snacks to maintain stable blood sugar and energy. Skipping meals causes blood sugar drops linked to fatigue, poor concentration, and overeating later. Meals combining complex carbohydrates, lean protein, and healthy fats provide sustained energy and help avoid the common mid-afternoon energy slump.',
  ARRAY['nutrition', 'energy', 'blood-sugar', 'meals', 'mayo-clinic']
),

(
  'Foods That Support Sleep Quality',
  'Tryptophan-rich foods — turkey, eggs, nuts, seeds, and dairy — support melatonin and serotonin production. Complex carbohydrates such as oatmeal and whole-grain bread increase tryptophan availability in the brain. Mayo Clinic advises avoiding large meals within 2–3 hours of bedtime, as active digestion delays sleep onset and reduces the proportion of deep restorative sleep.',
  ARRAY['nutrition', 'sleep', 'tryptophan', 'melatonin', 'mayo-clinic']
),

(
  'Diet, Gut Health, and Mood',
  'The WHO recognises a growing evidence base linking diet quality to mental wellbeing. Diets high in ultra-processed foods are associated with higher rates of depression and anxiety. Diets rich in vegetables, fruits, fish, and fermented foods support the gut microbiome, which communicates with the brain through the gut-brain axis and influences mood, anxiety, and cognition.',
  ARRAY['nutrition', 'gut-health', 'mood', 'mental-health', 'who']
),

(
  'Reducing Added Sugar for Stable Energy and Mood',
  'The CDC highlights that excess added sugar drives energy spikes and crashes. Sugar-sweetened beverages are the largest single source of added sugars in many diets. Replacing sugary drinks and snacks with whole foods and water produces more stable energy throughout the day, reduces systemic inflammation, and supports long-term metabolic and cardiovascular health.',
  ARRAY['nutrition', 'sugar', 'energy', 'inflammation', 'cdc']
),

-- ============================================================
-- HYDRATION (16–20)
-- ============================================================

(
  'Daily Water Intake Guidelines',
  'Mayo Clinic recommends approximately 3.7 litres of total fluid per day for men and 2.7 litres for women from all beverages and food combined. About 20% of daily fluid typically comes from food. Needs increase with body size, physical activity, heat, and illness. Thirst is not a reliable early warning of dehydration — regular drinking throughout the day is more effective.',
  ARRAY['hydration', 'water', 'fluids', 'mayo-clinic']
),

(
  'Effects of Mild Dehydration on Performance and Mood',
  'The CDC notes that a fluid loss of just 1–2% of body weight impairs cognitive performance, mood, and physical ability. Symptoms of mild dehydration include increased thirst, darker urine, fatigue, headache, and difficulty concentrating. Drinking water at regular intervals — rather than waiting for thirst — prevents the performance and mood dips that accompany even slight dehydration.',
  ARRAY['hydration', 'dehydration', 'cognitive', 'mood', 'cdc']
),

(
  'Hydration During and After Exercise',
  'The WHO recommends drinking water before, during, and after physical activity to support performance and temperature regulation. During moderate exercise the body loses 0.5–1 litre of fluid per hour through sweat. Dehydration reduces endurance, increases perceived effort, and impairs coordination. For activity lasting over one hour, electrolyte drinks help replace sodium and potassium lost in sweat.',
  ARRAY['hydration', 'exercise', 'electrolytes', 'performance', 'who']
),

(
  'Water-Rich Foods and Their Role in Hydration',
  'Many fruits and vegetables contribute substantially to daily hydration. Mayo Clinic notes that cucumbers, lettuce, celery, watermelon, and strawberries are over 90% water by weight. Including water-rich foods at meals is an effective strategy for people who struggle to drink enough plain water. Soups, herbal teas, and smoothies also count towards daily fluid intake.',
  ARRAY['hydration', 'fruits', 'vegetables', 'foods', 'mayo-clinic']
),

(
  'Beverages That Worsen Dehydration',
  'Alcohol and high-caffeine energy drinks have diuretic properties that accelerate fluid loss through urine. The CDC advises limiting alcohol and monitoring caffeinated intake during exercise or hot weather. Drinking a glass of water alongside each alcoholic or heavily caffeinated drink helps offset diuretic effects. Coffee in moderate amounts does not cause net dehydration for regular drinkers.',
  ARRAY['hydration', 'alcohol', 'caffeine', 'dehydration', 'cdc']
),

-- ============================================================
-- EXERCISE (21–25)
-- ============================================================

(
  'Weekly Physical Activity Guidelines for Adults',
  'The WHO and CDC recommend that adults perform at least 150–300 minutes of moderate-intensity aerobic activity or 75–150 minutes of vigorous activity per week, plus muscle-strengthening on two or more days. Meeting these guidelines reduces the risk of cardiovascular disease, type 2 diabetes, depression, and several cancers. Even modest increases in activity benefit previously inactive adults.',
  ARRAY['exercise', 'aerobic', 'guidelines', 'who', 'cdc']
),

(
  'Benefits of Regular Walking for Health',
  'The CDC highlights brisk walking as one of the most accessible and effective physical activities. A 30-minute daily brisk walk at approximately 3–4 miles per hour reduces the risk of heart disease, strengthens bones, improves balance and coordination, supports healthy weight, and boosts mood. It meets a large portion of weekly activity guidelines without requiring equipment or a gym membership.',
  ARRAY['exercise', 'walking', 'cardiovascular', 'mood', 'cdc']
),

(
  'Strength Training for Long-Term Health',
  'The WHO recommends muscle-strengthening activity for all adults at least twice per week. Resistance training — using body weight, free weights, or bands — maintains muscle mass that declines naturally with age. Regular strength training improves metabolic rate, bone density, joint stability, and functional independence, and is associated with lower all-cause mortality across age groups.',
  ARRAY['exercise', 'strength', 'resistance-training', 'bone-density', 'who']
),

(
  'Exercise as an Evidence-Based Mental Health Tool',
  'The CDC and WHO both recognise exercise as an evidence-based intervention for improving mental health. Regular physical activity reduces symptoms of depression and anxiety, improves sleep quality, and enhances cognitive function. A single moderate exercise session produces measurable mood improvements through endorphin, dopamine, and serotonin release. Consistency matters more than intensity for mental health outcomes.',
  ARRAY['exercise', 'mental-health', 'depression', 'anxiety', 'mood', 'cdc', 'who']
),

(
  'Building a Sustainable Exercise Habit',
  'Mayo Clinic advises starting with short 10-minute sessions and building gradually to reduce injury risk and improve adherence. Effective strategies include scheduling workouts as fixed appointments, choosing enjoyable activities, exercising with a partner for accountability, and tracking progress visually. Motivation is unreliable — attaching exercise to an existing daily habit produces stronger long-term adherence.',
  ARRAY['exercise', 'habit', 'motivation', 'routine', 'mayo-clinic']
),

-- ============================================================
-- MENTAL HEALTH SELF-CARE (26–30)
-- ============================================================

(
  'Mindfulness Practice for Stress and Anxiety',
  'The WHO recognises mindfulness — deliberate, non-judgmental attention to the present moment — as an effective tool for managing stress and improving wellbeing. Mayo Clinic highlights mindfulness-based stress reduction (MBSR) as an eight-week evidence-based programme shown to reduce anxiety, depression, and chronic pain. Starting with five minutes of mindful breathing daily builds the habit sustainably.',
  ARRAY['mental-health', 'mindfulness', 'meditation', 'anxiety', 'stress', 'who', 'mayo-clinic']
),

(
  'Expressive Journaling for Emotional Processing',
  'Writing regularly about thoughts, feelings, and experiences reduces psychological stress and supports emotional processing. Mayo Clinic recommends 15–20 minutes of free writing several times a week. Gratitude journaling — noting three things to be thankful for each day — is specifically linked to improved mood, better sleep quality, and reduced depressive symptoms. The process matters more than writing skill.',
  ARRAY['mental-health', 'journaling', 'gratitude', 'mood', 'sleep', 'mayo-clinic']
),

(
  'Setting Boundaries to Protect Mental Energy',
  'The WHO identifies boundary-setting as a core element of mental health self-care and burnout prevention. Boundaries protect emotional energy by clearly limiting what a person accepts from others. Practical steps include setting consistent off-hours for work communication, saying no to commitments that exceed capacity, and protecting personal time for rest and recovery without guilt.',
  ARRAY['mental-health', 'boundaries', 'burnout', 'self-care', 'work-life-balance', 'who']
),

(
  'Nature Exposure and Psychological Wellbeing',
  'WHO research links regular exposure to green spaces and natural environments with reduced cortisol, lower blood pressure, and improved mood. Even brief exposures — a 20-minute walk in a park, time near natural light, or tending to houseplants — produce measurable psychological benefits. Urban residents who visit green spaces regularly report lower rates of depression and anxiety than those who do not.',
  ARRAY['mental-health', 'nature', 'stress', 'mood', 'outdoor', 'who']
),

(
  'Sleep as a Foundation of Mental Health',
  'The CDC and WHO identify sleep as a foundational pillar of mental health. Chronic sleep deprivation increases the risk of depression by up to 40% and is a common trigger for anxiety. Prioritising consistent sleep hygiene, treating sleep disorders early, and protecting sleep time from work or social demands supports mood regulation, emotional resilience, and cognitive function throughout the day.',
  ARRAY['mental-health', 'sleep', 'depression', 'anxiety', 'resilience', 'cdc', 'who']
);
