
INSERT INTO products (name, description, price, image, category)
SELECT
    v.name,
    v.description,
    v.price,
    v.image,
    v.category
FROM (VALUES

    (
        'Cookies',
        'Cookie crocante por fora e macio por dentro, com sabor irresistível de chocolate e baunilha.',
        8.00,
        'produtos/produto 1.jpeg',
        'doces'
    ),
    (
        'Enroladinho de Salsicha',
        'Salsicha envolta em massa macia e dourada, ideal para um lanche rápido e saboroso.',
        12.00,
        'produtos/produto 2.jpg',
        'salgados'
    ),
    (
        'Torta de Frango',
        'Receita caseira com frango desfiado, cremosidade e massa crocante em cada mordida.',
        18.00,
        'produtos/produto 3.jpeg',
        'salgados'
    ),
    (
        'Sancuiche Natural',
        'Pão fresquinho com recheio natural e leve, uma opção prática e saborosa para o dia a dia.',
        16.00,
        'produtos/produto 4.jpg',
        'salgados'
    ),
    (
        'Sonho',
        'Rosquinha macia e fofa, polvilhada com açúcar e com recheio delicado.',
        10.00,
        'produtos/produto 5.jpeg',
        'doces'
    ),
    (
        'Torta de Laranja',
        'Torta cítrica com massa leve e um recheio cremoso de laranja bem equilibrado.',
        15.00,
        'produtos/produto 6.jpg',
        'doces'
    ),
    (
        'Dunuts',
        'Donuts fofos, dourados e irresistíveis, com textura macia e cobertura doce.',
        14.00,
        'produtos/produto 7.jpeg',
        'doces'
    ),
    (
        'Quiche',
        'Quiche com massa crocante e recheio saboroso, perfeito para um lanche mais completo.',
        18.00,
        'produtos/produto 8.jpg',
        'salgados'
    ),
    (
        'Brownie',
        'Brownie denso e úmido, com chocolate intenso e textura que derrete na boca.',
        12.00,
        'produtos/produto 9.jpeg',
        'doces'
    ),
    (
        'Torta de Limão',
        'Torta fresca de limão com cremosidade delicada e toque cítrico bem equilibrado.',
        15.00,
        'produtos/produto 10.jpg',
        'doces'
    ),
    (
        'Bolo de Cenoura',
        'Bolo úmido de cenoura com cobertura cremosa e sabor clássico e acolhedor.',
        12.00,
        'produtos/produto 11.jpeg',
        'doces'
    ),
    (
        'Pão na Chapa',
        'Pão tostado na chapa com manteiga, aroma levemente dourado e sabor marcante.',
        11.00,
        'produtos/produto 12.jpeg',
        'salgados'
    ),
    (
        'Misto Quente',
        'Sanduíche quente com queijo, presunto e pão tostado, um clássico irresistível.',
        15.00,
        'produtos/produto 13.jpeg',
        'salgados'
    ),
    (
        'Croassaint',
        'Croissant folhado e amanteigado, crocante por fora e macio por dentro.',
        13.00,
        'produtos/produto 14.jpeg',
        'salgados'
    ),
    (
        'Coxinha',
        'Coxinha crocante por fora e recheada com frango desfiado, uma opção tradicional e saborosa.',
        12.00,
        'produtos/produto 15.jpeg',
        'salgados'
    ),
    (
        'Pudim',
        'Pudim clássico e cremoso, com textura suave e sabor caramelizado de dar água na boca.',
        14.00,
        'produtos/produto 16.jpeg',
        'doces'
    )

) AS v(name, description, price, image, category)

WHERE NOT EXISTS (
    SELECT 1
    FROM products p
    WHERE LOWER(p.name) = LOWER(v.name)
);
