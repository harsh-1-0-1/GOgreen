"""Seed script: 10 categories + 50 products for Plantoga.

Usage:
    uv run python seed.py
"""

import asyncio
import random
import re
from datetime import datetime, timezone

from app.core.security import hash_password
from app.db.models import Banner, BlogCategory, BlogPost, Category, Product, User
from app.db.session import async_session_factory

UNSPLASH = "https://images.unsplash.com/photo-{id}?w=600&q=80"

PLANT_IMAGES = [
    UNSPLASH.format(id="1459411552884-841db9b3cc2a"),
    UNSPLASH.format(id="1463936575829-25148e1db1b8"),
    UNSPLASH.format(id="1509423350716-97f9360b4e09"),
    UNSPLASH.format(id="1520412099551-62b6bafeb5bb"),
    UNSPLASH.format(id="1485955900006-d5666c72437d"),
    UNSPLASH.format(id="1501004318776-cd2ba00a9cee"),
    UNSPLASH.format(id="1416879595882-3373a0480b5b"),
    UNSPLASH.format(id="1466692476868-aef1dfb1e735"),
]

CATEGORIES = [
    # Top-level
    {"name": "Plants", "slug": "plants", "parent_id": None},
    {"name": "Seeds", "slug": "seeds", "parent_id": None},
    {"name": "Pots & Planters", "slug": "pots-planters", "parent_id": None},
    {"name": "Plant Care", "slug": "plant-care", "parent_id": None},
    # Plants subcategories
    {"name": "Indoor Plants", "slug": "indoor-plants", "parent_slug": "plants"},
    {"name": "Outdoor Plants", "slug": "outdoor-plants", "parent_slug": "plants"},
    {"name": "Flowering Plants", "slug": "flowering-plants", "parent_slug": "plants"},
    {"name": "Cacti & Succulents", "slug": "cacti-succulents", "parent_slug": "plants"},
    {"name": "XL Plants", "slug": "xl-plants", "parent_slug": "plants"},
    {"name": "Low Maintenance Plants", "slug": "low-maintenance-plants", "parent_slug": "plants"},
    {"name": "Air Purifying Plants", "slug": "air-purifying-plants", "parent_slug": "plants"},
    {"name": "Hanging Plants", "slug": "hanging-plants", "parent_slug": "plants"},
    {"name": "Pet-Friendly Plants", "slug": "pet-friendly-plants", "parent_slug": "plants"},
    {"name": "Fruit Plants", "slug": "fruit-plants", "parent_slug": "plants"},
    # Seeds subcategories
    {"name": "Vegetable Seeds", "slug": "vegetable-seeds", "parent_slug": "seeds"},
    {"name": "Flower Seeds", "slug": "flower-seeds", "parent_slug": "seeds"},
    {"name": "Microgreen Seeds", "slug": "microgreen-seeds", "parent_slug": "seeds"},
    {"name": "Herb Seeds", "slug": "herb-seeds", "parent_slug": "seeds"},
    {"name": "Flower Bulbs", "slug": "flower-bulbs", "parent_slug": "seeds"},
    {"name": "Seeds Kits", "slug": "seeds-kits", "parent_slug": "seeds"},
    # Pots subcategories
    {"name": "Plastic Pots", "slug": "plastic-pots", "parent_slug": "pots-planters"},
    {"name": "Ceramic Pots", "slug": "ceramic-pots", "parent_slug": "pots-planters"},
    {"name": "Metal Planters", "slug": "metal-planters", "parent_slug": "pots-planters"},
    {"name": "Wooden Planters", "slug": "wooden-planters", "parent_slug": "pots-planters"},
    {"name": "Hanging Planters", "slug": "hanging-planters", "parent_slug": "pots-planters"},
    {"name": "Plant Stands", "slug": "plant-stands", "parent_slug": "pots-planters"},
    # Plant Care subcategories
    {"name": "Potting Mix & Fertilizers", "slug": "potting-mix-fertilizers", "parent_slug": "plant-care"},
    {"name": "Garden Tools", "slug": "garden-tools", "parent_slug": "plant-care"},
    {"name": "Watering Tools", "slug": "watering-tools", "parent_slug": "plant-care"},
    {"name": "Pest Control", "slug": "pest-control", "parent_slug": "plant-care"},
]

PRODUCTS = [
    # Indoor Plants (cat: indoor-plants)
    {"name": "Money Plant Golden", "cat": "indoor-plants", "price": 249, "desc": "Air-purifying trailing vine perfect for shelves and hanging baskets.", "sunlight": "Low to Bright Indirect", "watering": "Once a week", "tags": ["air-purifying", "low-maintenance", "indoor", "beginner-friendly", "workspace", "living-room"], "care_tips": ["Water when topsoil feels dry", "Prune to encourage bushier growth"], "badge": "Bestseller"},
    {"name": "Snake Plant Sansevieria", "cat": "indoor-plants", "price": 399, "desc": "Hardy succulent that thrives on neglect and purifies air at night.", "sunlight": "Low to Bright Indirect", "watering": "Every 2 weeks", "tags": ["air-purifying", "low-maintenance", "bedroom", "beginner-friendly", "workspace"], "care_tips": ["Avoid overwatering", "Tolerates low light well"], "badge": "Trending"},
    {"name": "Peace Lily", "cat": "indoor-plants", "price": 549, "desc": "Elegant white-flowering plant that removes toxins from indoor air.", "sunlight": "Low to Medium Indirect", "watering": "Twice a week", "tags": ["air-purifying", "flowering", "indoor", "beginner-friendly", "living-room"], "care_tips": ["Keep soil moist but not soggy", "Mist leaves in dry weather"]},
    {"name": "Pothos Marble Queen", "cat": "indoor-plants", "price": 199, "desc": "Variegated trailing plant with stunning white and green leaves.", "sunlight": "Bright Indirect", "watering": "Once a week", "tags": ["trailing", "variegated", "indoor", "low-maintenance", "beginner-friendly"], "care_tips": ["More light means more variegation", "Trim yellow leaves"]},
    {"name": "Areca Palm", "cat": "indoor-plants", "price": 699, "desc": "Tropical palm that adds lush greenery and humidifies your room.", "sunlight": "Bright Indirect", "watering": "Twice a week", "tags": ["air-purifying", "tropical", "large", "living-room"], "care_tips": ["Mist regularly", "Avoid direct sunlight to prevent leaf burn"], "badge": "Popular"},
    {"name": "ZZ Plant", "cat": "indoor-plants", "price": 449, "desc": "Glossy-leaved virtually indestructible houseplant.", "sunlight": "Low to Bright Indirect", "watering": "Every 2-3 weeks", "tags": ["low-maintenance", "modern", "indoor", "beginner-friendly", "workspace", "living-room"], "care_tips": ["Drought tolerant – do not overwater", "Wipe leaves for shine"]},
    {"name": "Rubber Plant", "cat": "indoor-plants", "price": 499, "desc": "Bold burgundy leaves that make a dramatic statement in any room.", "sunlight": "Bright Indirect", "watering": "Once a week", "tags": ["statement", "air-purifying", "indoor", "living-room"], "care_tips": ["Clean leaves monthly", "Rotate for even growth"]},
    {"name": "Jade Plant", "cat": "indoor-plants", "price": 349, "desc": "Lucky succulent symbolising prosperity and good fortune.", "sunlight": "Bright Direct to Indirect", "watering": "Every 2 weeks", "tags": ["succulent", "lucky", "desktop", "low-maintenance", "beginner-friendly", "workspace"], "care_tips": ["Let soil dry completely between waterings", "Avoid cold drafts"]},
    {"name": "Spider Plant", "cat": "indoor-plants", "price": 199, "desc": "Cheerful cascading foliage with baby plantlets on arching stems.", "sunlight": "Bright Indirect", "watering": "Once a week", "tags": ["pet-safe", "hanging", "beginner", "low-maintenance", "beginner-friendly", "bedroom"], "care_tips": ["Safe for cats and dogs", "Propagate babies in water"]},
    {"name": "Philodendron Brasil", "cat": "indoor-plants", "price": 299, "desc": "Heart-shaped variegated leaves in lime green and dark green.", "sunlight": "Medium to Bright Indirect", "watering": "Once a week", "tags": ["trailing", "variegated", "tropical"], "care_tips": ["Grows fast in bright light", "Trim leggy vines"]},
    # Outdoor Plants
    {"name": "Bougainvillea", "cat": "outdoor-plants", "price": 349, "desc": "Vibrant paper-like flowers in magenta that bloom year round.", "sunlight": "Full Sun", "watering": "Every 2-3 days", "tags": ["flowering", "drought-tolerant", "climber", "balcony"], "care_tips": ["Needs 6+ hours of sun", "Prune after each flowering cycle"], "badge": "Bestseller"},
    {"name": "Hibiscus Red", "cat": "outdoor-plants", "price": 299, "desc": "Classic tropical shrub with large scarlet blooms.", "sunlight": "Full Sun", "watering": "Daily in summer", "tags": ["flowering", "tropical", "outdoor", "balcony"], "care_tips": ["Feed monthly during growing season", "Protect from frost"]},
    {"name": "Mogra Jasmine", "cat": "outdoor-plants", "price": 399, "desc": "Intensely fragrant white flowers, a beloved Indian garden classic.", "sunlight": "Full Sun to Part Shade", "watering": "Every 2 days", "tags": ["fragrant", "flowering", "traditional"], "care_tips": ["Prune in early spring", "Apply organic compost monthly"]},
    {"name": "Curry Leaf Plant", "cat": "outdoor-plants", "price": 249, "desc": "Essential kitchen garden herb with aromatic leaves.", "sunlight": "Full Sun", "watering": "Every 2-3 days", "tags": ["herb", "edible", "kitchen-garden", "balcony"], "care_tips": ["Full sun is essential", "Pick leaves regularly to encourage growth"]},
    {"name": "Tulsi Holy Basil", "cat": "outdoor-plants", "price": 149, "desc": "Sacred Indian herb with medicinal and culinary uses.", "sunlight": "Full Sun", "watering": "Daily", "tags": ["herb", "medicinal", "sacred"], "care_tips": ["Pinch flower buds for bushy growth", "Keep well-watered in summer"]},
    # Flowering Plants
    {"name": "Anthurium Red", "cat": "flowering-plants", "price": 599, "desc": "Glossy heart-shaped red spathes that bloom for weeks.", "sunlight": "Bright Indirect", "watering": "Twice a week", "tags": ["flowering", "indoor", "gift", "gifting"], "care_tips": ["High humidity preferred", "Avoid direct sun"], "badge": "Gift Pick"},
    {"name": "Orchid Phalaenopsis White", "cat": "flowering-plants", "price": 799, "desc": "Elegant butterfly orchid with long-lasting cascading blooms.", "sunlight": "Bright Indirect", "watering": "Once a week (ice cube method)", "tags": ["flowering", "elegant", "gift", "gifting"], "care_tips": ["Water with 3 ice cubes weekly", "Repot every 2 years"]},
    {"name": "Chrysanthemum Yellow", "cat": "flowering-plants", "price": 199, "desc": "Cheerful pom-pom blooms in bright sunshine yellow.", "sunlight": "Full Sun to Part Shade", "watering": "Every 2 days", "tags": ["flowering", "outdoor", "festive"], "care_tips": ["Deadhead spent flowers", "Feed fortnightly"]},
    {"name": "Rose Plant Red", "cat": "flowering-plants", "price": 349, "desc": "Classic hybrid tea rose bush with fragrant deep-red blooms.", "sunlight": "Full Sun", "watering": "Every 2 days", "tags": ["flowering", "fragrant", "classic"], "care_tips": ["Prune in winter", "Spray neem oil for pests"]},
    {"name": "Kalanchoe Pink", "cat": "flowering-plants", "price": 249, "desc": "Long-blooming succulent with clusters of tiny pink flowers.", "sunlight": "Bright Direct", "watering": "Every 10 days", "tags": ["succulent", "flowering", "desktop"], "care_tips": ["Drought tolerant", "Short daylight triggers reblooming"]},
    # Cacti & Succulents
    {"name": "Echeveria Elegans", "cat": "cacti-succulents", "price": 199, "desc": "Blue-green rosette succulent, perfect for terrariums.", "sunlight": "Bright Direct", "watering": "Every 2 weeks", "tags": ["succulent", "rosette", "terrarium"], "care_tips": ["Use well-draining soil", "Avoid water on leaves"]},
    {"name": "Haworthia Zebra", "cat": "cacti-succulents", "price": 249, "desc": "Compact striped succulent that thrives on a bright windowsill.", "sunlight": "Bright Indirect", "watering": "Every 2-3 weeks", "tags": ["succulent", "compact", "desktop"], "care_tips": ["Perfect for small pots", "Tolerates some shade"]},
    {"name": "Barrel Cactus", "cat": "cacti-succulents", "price": 349, "desc": "Spherical ribbed cactus with golden spines.", "sunlight": "Full Sun", "watering": "Monthly", "tags": ["cactus", "drought-tolerant", "statement"], "care_tips": ["Minimal watering in winter", "Needs excellent drainage"]},
    {"name": "Aloe Vera", "cat": "cacti-succulents", "price": 199, "desc": "Medicinal gel-filled leaves useful for skin care.", "sunlight": "Bright Direct to Indirect", "watering": "Every 2 weeks", "tags": ["medicinal", "succulent", "beginner", "low-maintenance", "beginner-friendly"], "care_tips": ["Harvest outer leaves for gel", "Let soil dry between waterings"], "badge": "Essential"},
    {"name": "String of Pearls", "cat": "cacti-succulents", "price": 299, "desc": "Delicate trailing succulent with bead-like leaves.", "sunlight": "Bright Indirect", "watering": "Every 2 weeks", "tags": ["trailing", "hanging", "unique"], "care_tips": ["Bottom watering recommended", "Avoid overwatering"]},
    # Vegetable Seeds
    {"name": "Tomato Seeds (Cherry)", "cat": "vegetable-seeds", "price": 99, "desc": "Pack of 50 seeds – sweet cherry tomatoes, harvest in 60 days.", "sunlight": "Full Sun", "watering": "Daily", "tags": ["seeds", "edible", "kitchen-garden"], "care_tips": ["Start indoors 6 weeks before last frost", "Stake when 30 cm tall"]},
    {"name": "Spinach Seeds", "cat": "vegetable-seeds", "price": 79, "desc": "Easy-to-grow leafy green, perfect for winter sowing.", "sunlight": "Part Shade to Full Sun", "watering": "Every 2 days", "tags": ["seeds", "edible", "winter"], "care_tips": ["Sow directly in garden", "Harvest outer leaves first"]},
    {"name": "Chilli Seeds (Bhut Jolokia)", "cat": "vegetable-seeds", "price": 149, "desc": "Ghost pepper seeds – one of the hottest chillies in the world.", "sunlight": "Full Sun", "watering": "Every 2 days", "tags": ["seeds", "edible", "hot"], "care_tips": ["Germination takes 2-4 weeks", "Use gloves when harvesting"]},
    {"name": "Brinjal Seeds", "cat": "vegetable-seeds", "price": 89, "desc": "Purple long-variety aubergine, prolific producer in Indian summers.", "sunlight": "Full Sun", "watering": "Daily in summer", "tags": ["seeds", "edible", "summer"], "care_tips": ["Transplant seedlings at 4 leaf stage", "Rich compost helps"]},
    {"name": "Coriander Seeds", "cat": "vegetable-seeds", "price": 69, "desc": "Fast-growing herb essential for Indian cooking.", "sunlight": "Part Shade", "watering": "Daily", "tags": ["seeds", "herb", "kitchen-garden"], "care_tips": ["Sow every 3 weeks for continuous harvest", "Bolts in heat"]},
    # Flower Seeds
    {"name": "Sunflower Seeds", "cat": "flower-seeds", "price": 99, "desc": "Giant sunflower pack – grows up to 6 feet tall.", "sunlight": "Full Sun", "watering": "Every 2 days", "tags": ["seeds", "flowering", "tall"], "care_tips": ["Direct sow after last frost", "Support stems in wind"]},
    {"name": "Marigold Seeds", "cat": "flower-seeds", "price": 79, "desc": "Bright orange and yellow blooms, natural pest deterrent.", "sunlight": "Full Sun", "watering": "Every 2-3 days", "tags": ["seeds", "flowering", "pest-deterrent"], "care_tips": ["Deadhead for continuous blooming", "Attracts beneficial insects"]},
    {"name": "Zinnia Seeds Mix", "cat": "flower-seeds", "price": 99, "desc": "Vibrant mixed-colour zinnias – butterflies love them.", "sunlight": "Full Sun", "watering": "Every 2 days", "tags": ["seeds", "flowering", "butterfly"], "care_tips": ["Space 15 cm apart", "Avoid overhead watering"]},
    {"name": "Petunia Seeds", "cat": "flower-seeds", "price": 119, "desc": "Cascading petunias in purple, ideal for hanging baskets.", "sunlight": "Full Sun to Part Shade", "watering": "Daily", "tags": ["seeds", "flowering", "hanging"], "care_tips": ["Pinch tips for bushier growth", "Feed weekly with liquid fertiliser"]},
    {"name": "Cosmos Seeds", "cat": "flower-seeds", "price": 89, "desc": "Daisy-like blooms in pink and white, blooms all season.", "sunlight": "Full Sun", "watering": "Every 3 days", "tags": ["seeds", "flowering", "cottage-garden"], "care_tips": ["Poor soil produces more flowers", "Self-seeds readily"]},
    # Pots & Planters
    {"name": "Ceramic Planter White (6 inch)", "cat": "pots-planters", "price": 499, "desc": "Minimalist glossy white ceramic pot with drainage hole.", "tags": ["ceramic", "white", "modern"], "care_tips": ["Use a saucer to protect surfaces"]},
    {"name": "Terracotta Pot Classic (8 inch)", "cat": "pots-planters", "price": 199, "desc": "Traditional breathable clay pot, ideal for most plants.", "tags": ["terracotta", "classic", "breathable"], "care_tips": ["Soak in water before first use"]},
    {"name": "Self-Watering Planter (10 inch)", "cat": "pots-planters", "price": 899, "desc": "Built-in water reservoir keeps plants hydrated for days.", "tags": ["self-watering", "travel-friendly", "modern"], "care_tips": ["Fill reservoir every 5-7 days"], "badge": "Smart"},
    {"name": "Hanging Macramé Planter", "cat": "pots-planters", "price": 349, "desc": "Hand-knotted cotton macramé hanger – fits 6 inch pots.", "tags": ["macrame", "hanging", "boho"], "care_tips": ["Hang from sturdy hook rated for weight"]},
    {"name": "Metal Planter Gold (Set of 3)", "cat": "pots-planters", "price": 1299, "desc": "Set of 3 gold-finished geometric metal planters.", "tags": ["metal", "gold", "geometric", "set"], "care_tips": ["Use inner plastic liner to prevent rust"]},
    # Plant Care
    {"name": "Organic Vermicompost (5 kg)", "cat": "plant-care", "price": 299, "desc": "Nutrient-rich worm-cast compost for all plants.", "tags": ["organic", "compost", "fertiliser"], "care_tips": ["Mix into topsoil every 2 months"]},
    {"name": "Neem Oil Spray (500 ml)", "cat": "plant-care", "price": 249, "desc": "Cold-pressed neem oil – natural pesticide and fungicide.", "tags": ["organic", "pest-control", "neem", "spray"], "care_tips": ["Dilute before spraying", "Apply in evening to avoid leaf burn"], "badge": "Essential"},
    {"name": "Cocopeat Block (5 kg)", "cat": "plant-care", "price": 199, "desc": "Expands to 75 litres – improves soil aeration and water retention.", "tags": ["soil-amendment", "cocopeat", "organic"], "care_tips": ["Soak in water to expand", "Mix with perlite for best results"]},
    {"name": "Perlite (1 litre)", "cat": "plant-care", "price": 149, "desc": "Lightweight volcanic glass for improving drainage.", "tags": ["soil-amendment", "drainage", "perlite"], "care_tips": ["Mix 20-30% with potting soil"]},
    {"name": "Liquid Seaweed Fertiliser (500 ml)", "cat": "plant-care", "price": 349, "desc": "Concentrated organic feed that boosts root growth.", "tags": ["organic", "fertiliser", "liquid"], "care_tips": ["Dilute 5 ml per litre of water", "Apply fortnightly"]},
    {"name": "Pruning Shears", "cat": "plant-care", "price": 499, "desc": "Sharp bypass pruners with ergonomic grip for clean cuts.", "tags": ["tools", "pruning", "garden"], "care_tips": ["Clean blades after each use", "Oil the pivot regularly"]},
    {"name": "Plant Mister Brass (300 ml)", "cat": "plant-care", "price": 599, "desc": "Vintage brass mister for tropical plant humidity.", "tags": ["tools", "misting", "brass"], "care_tips": ["Mist plants in the morning"]},
    {"name": "Garden Gloves (Pair)", "cat": "plant-care", "price": 199, "desc": "Thorn-proof nitrile-coated gloves for safe gardening.", "tags": ["tools", "gloves", "safety"], "care_tips": ["Wash after use and air dry"]},
    {"name": "Seedling Tray (72 cells)", "cat": "plant-care", "price": 149, "desc": "Reusable plastic tray for starting seeds indoors.", "tags": ["tools", "propagation", "seeds"], "care_tips": ["Use dome lid for humidity until germination"]},
    {"name": "Moss Stick (2 ft)", "cat": "plant-care", "price": 129, "desc": "Coir moss pole for supporting climbing plants like Money Plant.", "tags": ["support", "moss-stick", "climbing"], "care_tips": ["Keep moss moist for aerial roots to grip"]},
    # ── XL Plants ──
    {"name": "Fiddle Leaf Fig XL", "cat": "xl-plants", "price": 2499, "desc": "Statement floor plant with large violin-shaped leaves, 4 ft tall.", "sunlight": "Bright Indirect", "watering": "Once a week", "tags": ["xl", "statement", "indoor", "living-room"], "care_tips": ["Wipe leaves monthly", "Rotate quarterly for even growth"], "badge": "XL"},
    {"name": "Bird of Paradise XL", "cat": "xl-plants", "price": 1999, "desc": "Tropical beauty with banana-like leaves, 3.5 ft tall.", "sunlight": "Bright Direct to Indirect", "watering": "Twice a week", "tags": ["xl", "tropical", "statement"], "care_tips": ["Needs high humidity", "Mist regularly"]},
    # ── Low Maintenance Plants ──
    {"name": "Cast Iron Plant", "cat": "low-maintenance-plants", "price": 599, "desc": "Nearly indestructible plant that thrives in dark corners.", "sunlight": "Low to Bright Indirect", "watering": "Every 2 weeks", "tags": ["low-maintenance", "shade-tolerant", "beginner-friendly"], "care_tips": ["Tolerates neglect well", "Avoid direct sun"]},
    {"name": "Dracaena Compacta", "cat": "low-maintenance-plants", "price": 499, "desc": "Compact rosette foliage that grows slowly and needs little care.", "sunlight": "Low to Medium Indirect", "watering": "Every 10 days", "tags": ["low-maintenance", "compact", "indoor", "beginner-friendly"], "care_tips": ["Sensitive to fluoride in tap water", "Let soil dry between waterings"]},
    # ── Air Purifying Plants ──
    {"name": "Boston Fern", "cat": "air-purifying-plants", "price": 349, "desc": "Lush hanging fern that removes formaldehyde and adds humidity.", "sunlight": "Bright Indirect", "watering": "Keep moist", "tags": ["air-purifying", "hanging", "tropical"], "care_tips": ["Mist daily in dry weather", "Keep away from heating vents"]},
    {"name": "English Ivy", "cat": "air-purifying-plants", "price": 249, "desc": "Classic trailing vine that filters airborne mold particles.", "sunlight": "Bright Indirect", "watering": "Once a week", "tags": ["air-purifying", "trailing", "indoor"], "care_tips": ["Trim regularly to control growth", "Spider mites love ivy – mist often"]},
    # ── Hanging Plants ──
    {"name": "String of Hearts", "cat": "hanging-plants", "price": 399, "desc": "Delicate heart-shaped leaves on trailing silvery vines.", "sunlight": "Bright Indirect", "watering": "Every 10 days", "tags": ["trailing", "hanging", "romantic"], "care_tips": ["Let soil dry between waterings", "Propagate easily from cuttings"]},
    {"name": "Lipstick Plant", "cat": "hanging-plants", "price": 449, "desc": "Cascading stems with tubular red flowers resembling lipstick.", "sunlight": "Bright Indirect", "watering": "Once a week", "tags": ["hanging", "flowering", "tropical"], "care_tips": ["High humidity encourages blooming", "Prune after flowering"]},
    # ── Pet-Friendly Plants ──
    {"name": "Calathea Orbifolia", "cat": "pet-friendly-plants", "price": 599, "desc": "Large round striped leaves, completely safe for cats and dogs.", "sunlight": "Medium Indirect", "watering": "Twice a week", "tags": ["pet-safe", "tropical", "indoor"], "care_tips": ["Use filtered water", "Loves humidity"]},
    {"name": "Parlor Palm", "cat": "pet-friendly-plants", "price": 449, "desc": "Compact palm safe for pets, thrives in low light.", "sunlight": "Low to Medium Indirect", "watering": "Once a week", "tags": ["pet-safe", "low-maintenance", "indoor", "beginner-friendly"], "care_tips": ["Avoid direct sun", "Wipe leaves to remove dust"]},
    # ── Fruit Plants ──
    {"name": "Lemon Plant", "cat": "fruit-plants", "price": 599, "desc": "Dwarf lemon tree that fruits on balconies and terraces.", "sunlight": "Full Sun", "watering": "Every 2 days", "tags": ["fruit", "edible", "outdoor"], "care_tips": ["Needs 6+ hours of sun", "Feed with citrus fertiliser monthly"]},
    {"name": "Pomegranate Plant", "cat": "fruit-plants", "price": 499, "desc": "Compact pomegranate variety perfect for container growing.", "sunlight": "Full Sun", "watering": "Every 2-3 days", "tags": ["fruit", "edible", "outdoor"], "care_tips": ["Prune to shape in winter", "Well-drained soil essential"]},
    # ── Microgreen Seeds ──
    {"name": "Microgreen Seeds – Mustard", "cat": "microgreen-seeds", "price": 99, "desc": "Spicy microgreens ready to harvest in just 7 days.", "sunlight": "Indirect Light", "watering": "Mist twice daily", "tags": ["seeds", "microgreen", "edible"], "care_tips": ["Use shallow tray with soilless medium", "Harvest at 2 inch height"]},
    {"name": "Microgreen Seeds – Sunflower", "cat": "microgreen-seeds", "price": 119, "desc": "Nutty, crunchy microgreens packed with nutrients.", "sunlight": "Indirect Light", "watering": "Mist twice daily", "tags": ["seeds", "microgreen", "edible"], "care_tips": ["Soak seeds overnight before sowing", "Blackout for first 3 days"]},
    # ── Herb Seeds ──
    {"name": "Basil Seeds (Sweet)", "cat": "herb-seeds", "price": 79, "desc": "Aromatic Italian basil for pesto, salads and cooking.", "sunlight": "Full Sun", "watering": "Daily", "tags": ["seeds", "herb", "edible", "kitchen-garden"], "care_tips": ["Pinch flower buds to extend harvest", "Sow indoors 6 weeks before summer"]},
    {"name": "Mint Seeds", "cat": "herb-seeds", "price": 69, "desc": "Refreshing spearmint – grows vigorously in pots.", "sunlight": "Part Shade to Full Sun", "watering": "Keep moist", "tags": ["seeds", "herb", "edible", "kitchen-garden"], "care_tips": ["Grows best in containers to control spreading", "Harvest regularly"]},
    # ── Flower Bulbs ──
    {"name": "Tuberose Bulbs (Pack of 5)", "cat": "flower-bulbs", "price": 199, "desc": "Fragrant white flowers, a summer garden favourite.", "sunlight": "Full Sun", "watering": "Every 2-3 days", "tags": ["seeds", "bulb", "fragrant", "flowering"], "care_tips": ["Plant 4 inches deep", "Lift bulbs in winter in cold regions"]},
    {"name": "Gladiolus Bulbs Mix (Pack of 10)", "cat": "flower-bulbs", "price": 299, "desc": "Tall colourful spikes in mixed colours – ideal for cutting.", "sunlight": "Full Sun", "watering": "Every 2-3 days", "tags": ["seeds", "bulb", "flowering", "cutting"], "care_tips": ["Stagger planting for continuous blooms", "Support tall stems"]},
    # ── Seeds Kits ──
    {"name": "Kitchen Garden Starter Kit", "cat": "seeds-kits", "price": 499, "desc": "Everything to grow tomatoes, chillies, and coriander at home.", "tags": ["seeds", "kit", "kitchen-garden", "beginner-friendly"], "care_tips": ["Follow included instructions", "Place in sunny spot"]},
    {"name": "Microgreen Growing Kit", "cat": "seeds-kits", "price": 399, "desc": "Tray, medium, and 4 seed varieties for fresh microgreens.", "tags": ["seeds", "kit", "microgreen", "beginner-friendly"], "care_tips": ["Harvest in 7-10 days", "Reuse tray for multiple batches"]},
    # ── Plastic Pots ──
    {"name": "Plastic Nursery Pot Set (6 inch, 5 pcs)", "cat": "plastic-pots", "price": 199, "desc": "Durable black nursery pots with drainage holes.", "tags": ["plastic", "nursery", "drainage"], "care_tips": ["Great for repotting and starting plants"]},
    {"name": "Colourful Plastic Planter (8 inch)", "cat": "plastic-pots", "price": 149, "desc": "Lightweight UV-resistant planter in assorted colours.", "tags": ["plastic", "colourful", "lightweight"], "care_tips": ["Ideal for balcony use"]},
    # ── Ceramic Pots ──
    {"name": "Ceramic Planter Matte Black (6 inch)", "cat": "ceramic-pots", "price": 549, "desc": "Sleek matte black ceramic pot with saucer.", "tags": ["ceramic", "black", "modern"], "care_tips": ["Has drainage hole – use saucer indoors"]},
    {"name": "Hand-Painted Ceramic Pot Blue (5 inch)", "cat": "ceramic-pots", "price": 699, "desc": "Artisan hand-painted pot with traditional blue pattern.", "tags": ["ceramic", "handmade", "decorative"], "care_tips": ["Handle with care – each piece is unique"]},
    # ── Metal Planters ──
    {"name": "Iron Bucket Planter Rustic", "cat": "metal-planters", "price": 399, "desc": "Vintage-style galvanised iron bucket planter.", "tags": ["metal", "rustic", "vintage"], "care_tips": ["Drill drainage holes or use as cachepot"]},
    {"name": "Copper Finish Planter (Set of 2)", "cat": "metal-planters", "price": 899, "desc": "Rose-gold copper finish planters for tabletop display.", "tags": ["metal", "copper", "set"], "care_tips": ["Use plastic liner to prevent oxidation"]},
    # ── Wooden Planters ──
    {"name": "Teak Wood Planter Box (12 inch)", "cat": "wooden-planters", "price": 1299, "desc": "Solid teak planter box, weather-resistant for outdoor use.", "tags": ["wooden", "teak", "outdoor"], "care_tips": ["Oil annually to maintain finish"]},
    {"name": "Pine Crate Planter (Small)", "cat": "wooden-planters", "price": 499, "desc": "Rustic pine crate planter with plastic liner.", "tags": ["wooden", "rustic", "boho"], "care_tips": ["Keep liner intact to prevent rot"]},
    # ── Hanging Planters ──
    {"name": "Rattan Hanging Basket (8 inch)", "cat": "hanging-planters", "price": 349, "desc": "Natural rattan basket with coconut coir liner.", "tags": ["hanging", "rattan", "natural"], "care_tips": ["Water slowly to prevent dripping"]},
    {"name": "Ceramic Hanging Planter White", "cat": "hanging-planters", "price": 599, "desc": "Minimalist white ceramic hanging pot with leather strap.", "tags": ["hanging", "ceramic", "modern"], "care_tips": ["Ensure ceiling hook rated for weight when watered"]},
    # ── Plant Stands ──
    {"name": "Bamboo Plant Stand (3-Tier)", "cat": "plant-stands", "price": 1499, "desc": "Three-tier bamboo shelf for displaying multiple plants.", "tags": ["stand", "bamboo", "multi-tier"], "care_tips": ["Wipe with damp cloth", "Place on even surface"]},
    {"name": "Metal Plant Stand Single (Mid-Century)", "cat": "plant-stands", "price": 699, "desc": "Gold metal mid-century modern plant stand for 8 inch pots.", "tags": ["stand", "metal", "modern"], "care_tips": ["Use felt pads under legs to protect floors"]},
    # ── Potting Mix & Fertilizers ──
    {"name": "Premium Potting Mix (10 litres)", "cat": "potting-mix-fertilizers", "price": 349, "desc": "Ready-to-use mix with cocopeat, perlite, and vermicompost.", "tags": ["potting-mix", "organic", "all-purpose"], "care_tips": ["Suitable for all indoor and outdoor plants"]},
    {"name": "Bone Meal Fertiliser (1 kg)", "cat": "potting-mix-fertilizers", "price": 199, "desc": "High phosphorus organic feed for flowering and fruiting plants.", "tags": ["organic", "fertiliser", "flowering"], "care_tips": ["Mix into soil every 6-8 weeks"]},
    # ── Garden Tools ──
    {"name": "3-Piece Garden Tool Set", "cat": "garden-tools", "price": 399, "desc": "Trowel, cultivator, and transplanter with wooden handles.", "tags": ["tools", "garden", "set"], "care_tips": ["Clean after each use to prevent rust"]},
    {"name": "Garden Knee Pad", "cat": "garden-tools", "price": 249, "desc": "Thick foam knee pad for comfortable gardening sessions.", "tags": ["tools", "comfort", "garden"], "care_tips": ["Wash with soap and water"]},
    # ── Watering Tools ──
    {"name": "Long Spout Watering Can (1.5L)", "cat": "watering-tools", "price": 449, "desc": "Precision long-spout can for indoor plants and seedlings.", "tags": ["tools", "watering", "indoor"], "care_tips": ["Copper finish – wipe dry to prevent water spots"]},
    {"name": "Garden Hose Nozzle (7 Pattern)", "cat": "watering-tools", "price": 349, "desc": "Adjustable spray nozzle with 7 patterns for different tasks.", "tags": ["tools", "watering", "outdoor"], "care_tips": ["Drain water before storing to prevent freezing"]},
    # ── Pest Control ──
    {"name": "Organic Insecticidal Soap (500 ml)", "cat": "pest-control", "price": 249, "desc": "Kills aphids, mealybugs, and whiteflies on contact.", "tags": ["organic", "pest-control", "spray", "garden-services"], "care_tips": ["Spray undersides of leaves", "Apply in evening"]},
    {"name": "Yellow Sticky Traps (Pack of 20)", "cat": "pest-control", "price": 149, "desc": "Non-toxic glue traps for fungus gnats and whiteflies.", "tags": ["pest-control", "trap", "non-toxic"], "care_tips": ["Replace every 2-3 weeks", "Place near plant base"]},
    # ── Gifting tagged products ──
    {"name": "Gift Box – Succulent Trio", "cat": "cacti-succulents", "price": 799, "desc": "Three mini succulents in a beautiful gift box with card.", "tags": ["gifting", "succulent", "gift", "combo"], "care_tips": ["Water sparingly – once every 2 weeks"], "badge": "Gift"},
    {"name": "Gift Set – Money Plant in Ceramic", "cat": "indoor-plants", "price": 599, "desc": "Money Plant in a premium ceramic pot, gift-wrapped.", "tags": ["gifting", "gift", "indoor", "beginner-friendly"], "care_tips": ["Water once a week", "Thrives in any light"], "badge": "Gift"},
    # ── Offers / combo tagged products ──
    {"name": "Combo – 4 Air Purifying Plants", "cat": "indoor-plants", "price": 699, "op": 1299, "desc": "Snake Plant, Peace Lily, Money Plant, and Spider Plant bundle.", "tags": ["combo", "offers", "air-purifying", "beginner-friendly", "bundle"], "care_tips": ["Each plant has different watering needs"], "badge": "Value Pack"},
    {"name": "Combo – Herb Garden Kit", "cat": "seeds", "price": 249, "op": 449, "desc": "Basil, Mint, and Coriander seeds with potting mix and tray.", "tags": ["combo", "offers", "herb", "kitchen-garden", "bundle"], "care_tips": ["Place in sunny spot", "Harvest regularly"]},
    {"name": "Seed Starter Mega Pack", "cat": "seeds", "price": 399, "desc": "Assorted 10-variety seed pack including vegetables, herbs, and flowers.", "tags": ["seeds", "kit", "beginner-friendly", "variety"], "care_tips": ["Refer to individual seed packets for sowing depth", "Start indoors for best results"]},
    # ── Corporate Gifts ──
    {"name": "Corporate Gift – Lucky Bamboo in Glass", "cat": "indoor-plants", "price": 499, "desc": "Elegant lucky bamboo arrangement in a glass vase, perfect for office desks.", "sunlight": "Low to Bright Indirect", "watering": "Keep water level consistent", "tags": ["corporate-gifts", "gifting", "gift", "workspace", "lucky"], "care_tips": ["Change water every 2 weeks", "Avoid direct sunlight"], "badge": "Corporate"},
    {"name": "Corporate Gift – Air Purifying Desk Set", "cat": "indoor-plants", "price": 899, "desc": "Set of 3 mini air-purifying plants in branded ceramic pots for offices.", "sunlight": "Low to Bright Indirect", "watering": "Once a week", "tags": ["corporate-gifts", "gifting", "gift", "workspace", "air-purifying", "combo"], "care_tips": ["Perfect for conference rooms and desks"], "badge": "Corporate"},
    {"name": "Corporate Gift – Succulent Terrarium", "cat": "cacti-succulents", "price": 1299, "desc": "Handcrafted glass terrarium with 5 premium succulents, ideal for corporate events.", "tags": ["corporate-gifts", "gifting", "gift", "terrarium", "succulent"], "care_tips": ["Water sparingly once every 3 weeks"], "badge": "Corporate"},
    # ── Garden Services tagged products ──
    {"name": "Balcony Garden Setup Service", "cat": "plant-care", "price": 2999, "desc": "Complete balcony garden setup with 10 plants, pots, soil, and expert installation.", "tags": ["garden-services", "balcony", "outdoor", "combo"], "care_tips": ["Our team will guide you on maintenance after setup"]},
    {"name": "Indoor Plant Styling Service", "cat": "plant-care", "price": 1999, "desc": "Professional plant stylist visits your space and creates a curated indoor garden.", "tags": ["garden-services", "indoor", "living-room", "workspace"], "care_tips": ["Includes plant selection and placement consultation"]},
]


BLOG_POSTS = [
    {
        "title": "10 Types of Fertilizers That Help Grow Plants",
        "excerpt": "From vermicompost to liquid seaweed, understand which fertilizer works best for your garden and when to apply it.",
        "category": BlogCategory.GROW,
        "cover": "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=1200&q=80",
        "author": "Plantoga Team",
        "content": """## Choosing the Right Fertilizer

Plants need three primary nutrients: **Nitrogen (N)**, **Phosphorus (P)**, and **Potassium (K)**. Different fertilizers supply these in different ratios.

### Organic Fertilizers
1. **Vermicompost** — Worm castings rich in micronutrients. Great for all plants.
2. **Neem Cake** — Slow-release nitrogen + natural pest deterrent.
3. **Bone Meal** — High phosphorus; ideal for flowering plants and bulbs.
4. **Fish Emulsion** — Fast-acting liquid with balanced NPK.
5. **Seaweed Extract** — Packed with trace minerals and growth hormones.

### Synthetic Fertilizers
6. **NPK 19-19-19** — Balanced all-purpose granular feed.
7. **DAP (Diammonium Phosphate)** — Boosts root development.
8. **Urea** — Very high nitrogen; use sparingly for leafy greens.

### Specialty Options
9. **Epsom Salt** — Provides magnesium; great for tomatoes and roses.
10. **Coconut Husk Chips** — Slow-release potassium and improved aeration.

### When to Fertilize
- **Growing season** (March\u2013October): Feed every 2\u20134 weeks.
- **Winter**: Reduce or stop feeding \u2014 most plants are dormant.

Always water the soil before applying fertilizer to avoid root burn.""",
    },
    {
        "title": "13 Ways to Save Your Drying or Dead Plant",
        "excerpt": "Don't give up on your wilting houseplant just yet. Here are 13 proven techniques to revive even the most neglected greenery.",
        "category": BlogCategory.CARE,
        "cover": "https://images.unsplash.com/photo-1459411552884-841db9b3cc2a?w=1200&q=80",
        "author": "Plantoga Team",
        "content": """## Is Your Plant Dying? Here's How to Save It

Every plant parent has been there \u2014 yellowing leaves, drooping stems, dry soil. But most plants are more resilient than you think.

### 1. Check the Soil Moisture
Stick your finger 2 inches into the soil. Bone dry? Time for a deep soak. Soggy? You may be overwatering.

### 2. Inspect for Root Rot
Gently remove the plant from its pot. Healthy roots are white or tan; mushy brown roots mean rot. Trim the damaged ones with sterile scissors.

### 3. Adjust Your Watering Schedule
Most indoor plants prefer to dry out slightly between waterings. Set a weekly reminder rather than watering on a fixed schedule.

### 4. Move to Better Light
A plant that's stretching or losing colour likely needs more light. Shift it closer to a window, but avoid harsh afternoon sun.

### 5. Trim Dead Foliage
Removing yellow or brown leaves lets the plant redirect energy to new growth.

### 6\u201313: More Quick Wins
- **Repot** into fresh potting mix if the soil is compacted.
- **Mist** tropical plants to raise humidity.
- **Feed** with diluted liquid fertiliser during the growing season.
- **Check for pests** \u2014 look under leaves for mealybugs or spider mites.
- **Quarantine** infected plants away from healthy ones.
- **Reduce fertiliser** if leaf tips are burnt.
- **Prune leggy stems** to encourage bushier regrowth.
- **Be patient** \u2014 recovery takes 2\u20134 weeks.

With a little attention, most houseplants bounce back beautifully.""",
    },
    {
        "title": "How to Set Up a Balcony Garden",
        "excerpt": "Transform your apartment balcony into a lush green retreat with this step-by-step guide to container gardening.",
        "category": BlogCategory.DIY,
        "cover": "https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?w=1200&q=80",
        "author": "Plantoga Team",
        "content": """## Your Balcony Garden, Step by Step

You don't need a backyard to be a gardener. A balcony \u2014 even a small one \u2014 can host a thriving container garden.

### Step 1: Assess Your Space
- **Direction**: South or west-facing gets the most sun.
- **Weight limit**: Check with your building \u2014 large pots filled with wet soil are heavy.
- **Wind exposure**: Higher floors may need wind barriers.

### Step 2: Choose the Right Containers
- Minimum **6-inch pots** for herbs; **10-12 inch** for vegetables and larger plants.
- Ensure every pot has **drainage holes**.
- Self-watering planters are ideal if you travel often.

### Step 3: Pick Your Plants
**Full Sun (6+ hours):** Tomatoes, chillies, bougainvillea, marigold.
**Part Shade (3\u20135 hours):** Money plant, ferns, lettuce, coriander.
**Low Light (indirect):** Snake plant, ZZ plant, pothos.

### Step 4: Soil & Feeding
Use a **quality potting mix** \u2014 not garden soil, which compacts in pots. Mix in cocopeat and perlite for better drainage.

### Step 5: Watering
- Water **early morning** or **late evening**.
- Check soil moisture daily in summer; every 2\u20133 days in winter.
- Mulch the surface with pebbles to reduce evaporation.

### Bonus: Vertical Gardening
Hang planters on railings, use wall-mounted pockets, or install a trellis for climbers like money plant or passion fruit.""",
    },
    {
        "title": "5 Plants That Purify Indoor Air",
        "excerpt": "NASA research shows these houseplants actively remove toxins like formaldehyde and benzene from your home.",
        "category": BlogCategory.TIPS,
        "cover": "https://images.unsplash.com/photo-1509423350716-97f9360b4e09?w=1200&q=80",
        "author": "Plantoga Team",
        "content": """## Breathe Easier with These Air-Purifying Plants

Indoor air can be 2\u20135 times more polluted than outdoor air. Houseplants are a natural, beautiful way to filter toxins.

### 1. Snake Plant (Sansevieria)
- **Removes:** Formaldehyde, benzene, trichloroethylene
- **Bonus:** Releases oxygen at night \u2014 perfect for bedrooms
- **Care:** Water every 2\u20133 weeks; tolerates low light

### 2. Peace Lily
- **Removes:** Ammonia, formaldehyde, benzene
- **Bonus:** Beautiful white blooms year-round
- **Care:** Keep soil moist; thrives in low to medium light

### 3. Areca Palm
- **Removes:** Formaldehyde, xylene, toluene
- **Bonus:** Acts as a natural humidifier
- **Care:** Bright indirect light; water twice weekly

### 4. Money Plant (Pothos)
- **Removes:** Formaldehyde, carbon monoxide
- **Bonus:** Nearly impossible to kill
- **Care:** Water weekly; grows in water or soil

### 5. Rubber Plant
- **Removes:** Formaldehyde
- **Bonus:** Large dramatic leaves make a design statement
- **Care:** Bright indirect light; wipe leaves monthly

### How Many Plants Do You Need?
NASA recommends **1 plant per 100 sq ft** for noticeable air quality improvement. A typical 2BHK apartment benefits from 6\u201310 plants.""",
    },
]


def _pick_images() -> list[str]:
    return random.sample(PLANT_IMAGES, k=random.randint(1, 3))


def _original_price(price: float) -> float:
    markup = random.uniform(1.15, 1.50)
    return round(price * markup)


async def seed() -> None:
    async with async_session_factory() as db:
        # Clear existing seed data so the script is re-runnable
        await db.execute(Banner.__table__.delete())
        await db.execute(Product.__table__.delete())
        await db.execute(Category.__table__.delete())
        await db.execute(BlogPost.__table__.delete())
        await db.execute(User.__table__.delete())
        await db.flush()
        print("Cleared existing data.\n")

        # Admin user
        admin = User(
            email="admin@example.com",
            hashed_password=hash_password("adminadmin"),
            full_name="Admin",
            is_active=True,
            is_admin=True,
        )
        db.add(admin)
        await db.flush()
        print(f"  Admin user: {admin.email} (id={admin.id})")

        slug_to_id: dict[str, int] = {}

        for cat_data in CATEGORIES:
            parent_id = cat_data.get("parent_id")
            parent_slug = cat_data.get("parent_slug")
            if parent_slug:
                parent_id = slug_to_id.get(parent_slug)

            cat = Category(
                name=cat_data["name"],
                slug=cat_data["slug"],
                parent_id=parent_id,
                is_active=True,
            )
            db.add(cat)
            await db.flush()
            await db.refresh(cat)
            slug_to_id[cat.slug] = cat.id
            print(f"  Category: {cat.name} (id={cat.id})")

        for p in PRODUCTS:
            cat_id = slug_to_id[p["cat"]]
            slug = p["name"].lower().strip()
            slug = re.sub(r"[^\w\s-]", "", slug)
            slug = re.sub(r"[\s_]+", "-", slug)
            slug = re.sub(r"-+", "-", slug).strip("-")

            product = Product(
                name=p["name"],
                slug=slug,
                description=p.get("desc", ""),
                price=p["price"],
                original_price=p["op"] if "op" in p else _original_price(p["price"]),
                stock_qty=random.randint(5, 200),
                category_id=cat_id,
                images=_pick_images(),
                tags=p.get("tags", []),
                care_tips=p.get("care_tips", []),
                sunlight=p.get("sunlight"),
                watering=p.get("watering"),
                badge=p.get("badge"),
                is_active=True,
            )
            db.add(product)

        for bp in BLOG_POSTS:
            slug = bp["title"].lower().strip()
            slug = re.sub(r"[^\w\s-]", "", slug)
            slug = re.sub(r"[\s_]+", "-", slug)
            slug = re.sub(r"-+", "-", slug).strip("-")

            post = BlogPost(
                title=bp["title"],
                slug=slug,
                excerpt=bp["excerpt"],
                content=bp["content"],
                cover_image_url=bp["cover"],
                category=bp["category"],
                author_name=bp["author"],
                is_published=True,
                published_at=datetime.now(timezone.utc),
            )
            db.add(post)

        banners_seed = [
            Banner(
                title="Get your first plant set!",
                subtitle="Handpicked plants delivered to your door",
                cta_text="Shop Now",
                cta_link="/products",
                badge_text="4 Plants @ ₹699",
                placement="hero",
                position=0,
                bg_color="#F5F0E8",
                text_color="#1B4332",
                image_url="https://images.unsplash.com/photo-1545241047-6083a3684587?w=1400&h=600&fit=crop&crop=center",
            ),
            Banner(
                title="Less care. More green.",
                subtitle="Low-maintenance plants for your home.",
                cta_text="Shop Plants",
                cta_link="/products?tags=low-maintenance",
                placement="hero",
                position=1,
                bg_color="#E8F0E8",
                text_color="#1B4332",
                image_url="https://images.unsplash.com/photo-1463936575829-25148e1db1b8?w=1400&h=600&fit=crop&crop=center",
            ),
            Banner(
                title="New to plants?",
                subtitle="Start with the easy ones.",
                cta_text="See Beginner Plants",
                cta_link="/products?tags=beginner-friendly",
                placement="hero",
                position=2,
                bg_color="#1B4332",
                text_color="#FFFFFF",
                image_url="https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=1400&h=600&fit=crop&crop=center",
            ),
            Banner(
                title="Free Delivery Above ₹499 | Shop Now",
                cta_link="/products",
                placement="announcement",
                position=0,
                bg_color="#1B4332",
                text_color="#FFFFFF",
            ),
            Banner(
                title="Get 4 Plants @ just ₹699!",
                cta_link="/products?tags=bundle",
                placement="announcement",
                position=1,
                bg_color="#1B4332",
                text_color="#FFFFFF",
            ),
            Banner(
                title="Next-Day Delivery Available",
                cta_link="/next-day-delivery",
                placement="announcement",
                position=2,
                bg_color="#1B4332",
                text_color="#FFFFFF",
            ),
        ]
        db.add_all(banners_seed)

        await db.commit()
        print(
            f"\nSeeded 1 admin, {len(CATEGORIES)} categories, "
            f"{len(PRODUCTS)} products, {len(BLOG_POSTS)} blog posts, "
            f"and {len(banners_seed)} banners."
        )


if __name__ == "__main__":
    asyncio.run(seed())
