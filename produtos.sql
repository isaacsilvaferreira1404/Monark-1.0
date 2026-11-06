
INSERT INTO products (name, description, price, image, category)
SELECT
    v.name,
    v.description,
    v.price,
    v.image,
    v.category
FROM (VALUES

    -- CAFÉS
    (
        'Espresso Monark',
        'Café intenso, encorpado e com aroma marcante.',
        8.00,
        "Assets/monark (3).jpeg",
        'cafes'
    ),
    (
        'Cappuccino',
        'Café com leite cremoso e uma delicada camada de espuma.',
        13.00,
        'Assets/cafe2.jpg',
        'cafes'
    ),
    (
        'Café Latte',
        'Espresso equilibrado com leite vaporizado.',
        12.00,
        'Assets/cafe3.jpg',
        'cafes'
    ),

    -- BEBIDAS
    (
        'Cold Coffee',
        'Café gelado, refrescante e equilibrado.',
        14.00,
        'Assets/bebida1.jpg',
        'bebidas'
    ),
    (
        'Chocolate Quente',
        'Chocolate cremoso, perfeito para dias mais frios.',
        12.00,
        'Assets/bebida2.jpg',
        'bebidas'
    ),
    (
        'Suco Natural',
        'Suco natural preparado com frutas selecionadas.',
        9.00,
        'Assets/bebida3.jpg',
        'bebidas'
    ),

    -- DOCES
    (
        'Bolo de Chocolate',
        'Massa macia com recheio especial de chocolate.',
        12.00,
        'Assets/doce1.jpg',
        'doces'
    ),
    (
        'Croissant Doce',
        'Massa folhada e crocante com recheio especial.',
        11.00,
        'Assets/doce2.jpg',
        'doces'
    ),
    (
        'Brownie',
        'Brownie artesanal com chocolate meio amargo.',
        10.00,
        'Assets/doce3.jpg',
        'doces'
    ),

    -- SALGADOS
    (
        'Sanduíche Artesanal',
        'Pão macio com queijo e ingredientes selecionados.',
        16.00,
        'Assets/salgado1.jpg',
        'salgados'
    ),
    (
        'Pão de Queijo',
        'Pão de queijo quentinho, macio por dentro e crocante por fora.',
        7.00,
        'Assets/salgado2.jpg',
        'salgados'
    ),
    (
        'Croissant Salgado',
        'Croissant folhado com recheio de queijo.',
        13.00,
        'Assets/salgado3.jpg',
        'salgados'
    )

) AS v(name, description, price, image, category)

WHERE NOT EXISTS (
    SELECT 1
    FROM products p
    WHERE LOWER(p.name) = LOWER(v.name)
);
