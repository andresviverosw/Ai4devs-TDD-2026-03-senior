import supertest from "supertest";
import { validateCandidateData } from "../application/validator";
import { addCandidate } from "../application/services/candidateService";

jest.mock("../domain/models/Candidate");
jest.mock("../domain/models/Education");
jest.mock("../domain/models/WorkExperience");
jest.mock("../domain/models/Resume");

import { Candidate } from "../domain/models/Candidate";
import { Education } from "../domain/models/Education";
import { WorkExperience } from "../domain/models/WorkExperience";
import { Resume } from "../domain/models/Resume";

const MockedCandidate = Candidate as jest.MockedClass<typeof Candidate>;
const MockedEducation = Education as jest.MockedClass<typeof Education>;
const MockedWorkExperience = WorkExperience as jest.MockedClass<
    typeof WorkExperience
>;
const MockedResume = Resume as jest.MockedClass<typeof Resume>;

/** Helpers: minimal valid payloads (Spanish phone: 9 digits starting with 6, 7, or 9). */
function baseValidPayload(): Record<string, unknown> {
    return {
        firstName: "María",
        lastName: "García",
        email: "maria.garcia@example.com",
        phone: "612345678",
        address: "Calle Ejemplo 1",
    };
}

describe("Familia A — receptor de datos del formulario (validateCandidateData)", () => {
    describe("reglas cuando el payload corresponde a alta (sin id)", () => {
        // Criterio: nombres y apellidos deben tener longitud válida y solo caracteres permitidos (letras Unicode y espacio).
        it("given nombres y apellidos válidos when validateCandidateData runs then no lanza error", () => {
            expect(() =>
                validateCandidateData({
                    ...baseValidPayload(),
                })
            ).not.toThrow();
        });

        // Criterio: nombre demasiado corto o caracteres fuera del patrón se rechazan igual que primera línea del formulario incompleta/ inválida.
        it('given nombre de un solo carácter válido cuando validateCandidateData runs then lanzas "Invalid name"', () => {
            expect(() =>
                validateCandidateData({
                    ...baseValidPayload(),
                    firstName: "X",
                })
            ).toThrow("Invalid name");
        });

        // Criterio: email debe cumplir el regex configurado exactamente igual que rechazo en servidor del formulario.
        it('given email con formato incorrecto cuando validateCandidateData runs then lanzas "Invalid email"', () => {
            expect(() =>
                validateCandidateData({
                    ...baseValidPayload(),
                    email: "no-es-un-email",
                })
            ).toThrow("Invalid email");
        });

        // Criterio: teléfono es opcional; si está vacío/no enviado, no debe fallar por formato.
        it("given sin teléfono when validateCandidateData runs then no lanza error", () => {
            const { phone: _omit, ...rest } = baseValidPayload() as {
                phone?: string;
            };
            expect(() =>
                validateCandidateData({
                    ...rest,
                    phone: undefined,
                })
            ).not.toThrow();
        });

        // Criterio: si viene teléfono, debe tener 9 cifras y empezar por 6, 7 o 9 (contrato igual que cliente).
        it('given teléfono con prefijo no permitido cuando validateCandidateData runs then lanzas "Invalid phone"', () => {
            expect(() =>
                validateCandidateData({
                    ...baseValidPayload(),
                    phone: "812345678",
                })
            ).toThrow("Invalid phone");
        });

        // Criterio: dirección opcional pero acotada a 100 caracteres como en BD.
        it('given dirección que supera la longitud permitida cuando validateCandidateData runs then lanzas "Invalid address"', () => {
            expect(() =>
                validateCandidateData({
                    ...baseValidPayload(),
                    address: "a".repeat(101),
                })
            ).toThrow("Invalid address");
        });

        // Criterio: bloque education valida institución/título/longitud/fechas como en alta de estudios desde el formulario.
        it("given entrada educativa con título demasiado largo when validateCandidateData runs then lanzas error de título", () => {
            expect(() =>
                validateCandidateData({
                    ...baseValidPayload(),
                    educations: [
                        {
                            institution: "Universidad",
                            title: "a".repeat(101),
                            startDate: "2020-01-01",
                            endDate: "2021-06-30",
                        },
                    ],
                })
            ).toThrow("Invalid title");
        });

        // Criterio: fechas educativas deben ser YYYY-MM-DD; endDate puede omitirse.
        it('given educación con startDate inválido cuando validateCandidateData runs then lanzas "Invalid date"', () => {
            expect(() =>
                validateCandidateData({
                    ...baseValidPayload(),
                    educations: [
                        {
                            institution: "Universidad",
                            title: "Grado",
                            startDate: "01-01-2020",
                        },
                    ],
                })
            ).toThrow("Invalid date");
        });

        // Criterio: experiencia laboral valida empresa, puesto, descripción acotada y fechas.
        it('given experiencia con descripción demasiado larga when validateCandidateData runs then lanzas "Invalid description"', () => {
            expect(() =>
                validateCandidateData({
                    ...baseValidPayload(),
                    workExperiences: [
                        {
                            company: "ACME",
                            position: "Dev",
                            description: "x".repeat(201),
                            startDate: "2019-01-01",
                        },
                    ],
                })
            ).toThrow("Invalid description");
        });

        // Criterio: CV solo se valida si el objeto enviado tiene claves (no vacío); debe incluir filePath y fileType string.
        it('given cv enviado como objeto vacío when validateCandidateData runs then no exige campos de CV', () => {
            expect(() =>
                validateCandidateData({
                    ...baseValidPayload(),
                    cv: {},
                })
            ).not.toThrow();
        });

        it('given cv con datos incompletos cuando validateCandidateData runs then lanzas "Invalid CV data"', () => {
            expect(() =>
                validateCandidateData({
                    ...baseValidPayload(),
                    cv: { filePath: "/tmp/x.pdf" },
                })
            ).toThrow("Invalid CV data");
        });
    });

    describe("comportamiento cuando el body incluye id (flujo distinto al alta pura)", () => {
        // Criterio: si presence de id, el validador asume edición y no valida campos obligatorios de alta (contrato actual del backend).
        it("given payload con id presente when validateCandidateData runs then no valida nombres/email aunque falten", () => {
            expect(() =>
                validateCandidateData({
                    id: 1,
                    firstName: "",
                    email: "no-email",
                })
            ).not.toThrow();
        });
    });
});

describe("Familia B — guardado en base de datos (addCandidate con modelos mockeados)", () => {
    const mockCandidateSave = jest.fn();
    const mockEducationSave = jest.fn();
    const mockWorkSave = jest.fn();
    const mockResumeSave = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();

        mockCandidateSave.mockResolvedValue({
            id: 42,
            firstName: "María",
            lastName: "García",
            email: "maria.garcia@example.com",
            phone: "612345678",
            address: "Calle Ejemplo 1",
        });

        mockEducationSave.mockResolvedValue({ id: 1 });
        mockWorkSave.mockResolvedValue({ id: 2 });
        mockResumeSave.mockResolvedValue({});

        MockedCandidate.mockImplementation(
            () =>
                ({
                    education: [],
                    workExperience: [],
                    resumes: [],
                    save: mockCandidateSave,
                }) as unknown as Candidate
        );

        MockedEducation.mockImplementation(
            () =>
                ({
                    candidateId: undefined as number | undefined,
                    save: mockEducationSave,
                }) as unknown as Education
        );

        MockedWorkExperience.mockImplementation(
            () =>
                ({
                    candidateId: undefined as number | undefined,
                    save: mockWorkSave,
                }) as unknown as WorkExperience
        );

        MockedResume.mockImplementation(
            () =>
                ({
                    candidateId: undefined as number | undefined,
                    save: mockResumeSave,
                }) as unknown as Resume
        );
    });

    // Criterio: tras validar, se persiste el candidato vía Candidate.save y se devuelve el registro “base” sin tocar Prisma real.
    it("given datos mínimos válidos when addCandidate runs then llama save del candidato una vez y retorna el resultado", async () => {
        const payload = baseValidPayload();
        const result = await addCandidate(payload);

        expect(mockCandidateSave).toHaveBeenCalledTimes(1);
        expect(result).toMatchObject({ id: 42, email: payload.email });
        expect(mockEducationSave).not.toHaveBeenCalled();
        expect(mockWorkSave).not.toHaveBeenCalled();
        expect(mockResumeSave).not.toHaveBeenCalled();
    });

    // Criterio: por cada ítem de educaciones se instancia Education, se asigna candidateId del guardado y se llama save (misma transacción lógica que el servicio).
    it("given varias educaciones when addCandidate runs then persiste cada una con el id del candidato", async () => {
        const payload = {
            ...baseValidPayload(),
            educations: [
                {
                    institution: "Uni A",
                    title: "Grado A",
                    startDate: "2018-09-01",
                    endDate: "2022-06-30",
                },
                {
                    institution: "Uni B",
                    title: "Máster B",
                    startDate: "2022-10-01",
                },
            ],
        };

        await addCandidate(payload);

        expect(MockedEducation).toHaveBeenCalledTimes(2);
        expect(mockEducationSave).toHaveBeenCalledTimes(2);
        const firstInstance = MockedEducation.mock.results[0].value as {
            candidateId?: number;
        };
        expect(firstInstance.candidateId).toBe(42);
    });

    // Criterio: experiencias laborales siguen el mismo patrón que educación (id del candidato + save por fila).
    it("given experiencias laborales when addCandidate runs then llama save por cada experiencia", async () => {
        const payload = {
            ...baseValidPayload(),
            workExperiences: [
                {
                    company: "ACME",
                    position: "Dev",
                    startDate: "2020-01-01",
                    endDate: "2021-12-31",
                },
            ],
        };

        await addCandidate(payload);

        expect(MockedWorkExperience).toHaveBeenCalledTimes(1);
        expect(mockWorkSave).toHaveBeenCalledTimes(1);
    });

    // Criterio: CV con claves no vacías dispara Resume.save asociado al candidato; {} no dispara.
    it("given cv con metadatos when addCandidate runs then invoca save del CV", async () => {
        await addCandidate({
            ...baseValidPayload(),
            cv: {
                filePath: "/uploads/cv.pdf",
                fileType: "application/pdf",
            },
        });

        expect(MockedResume).toHaveBeenCalledTimes(1);
        expect(mockResumeSave).toHaveBeenCalledTimes(1);
    });

    it("given cv vacío when addCandidate runs then no persiste CV", async () => {
        await addCandidate({
            ...baseValidPayload(),
            cv: {},
        });

        expect(mockResumeSave).not.toHaveBeenCalled();
    });

    // Criterio: error Prisma P2002 (email duplicado) se traduce a mensaje de negocio estable para el cliente.
    it('given email duplicado en BD when addCandidate runs then lanza "The email already exists in the database"', async () => {
        mockCandidateSave.mockRejectedValueOnce({ code: "P2002" });

        await expect(addCandidate(baseValidPayload())).rejects.toThrow(
            "The email already exists in the database"
        );
    });

    // Criterio: otros errores de persistencia se propagan sin envolver (excepto P2002).
    it("given error genérico al guardar candidato when addCandidate runs then propaga el mismo error", async () => {
        const err = new Error("db down");
        mockCandidateSave.mockRejectedValueOnce(err);

        await expect(addCandidate(baseValidPayload())).rejects.toThrow("db down");
    });

    // Criterio: datos inválidos del formulario no llegan a save (falla en validación).
    it('given email inválido when addCandidate runs then no llama save y lanza error de validación', async () => {
        await expect(
            addCandidate({
                ...baseValidPayload(),
                email: "no-email",
            })
        ).rejects.toThrow();

        expect(mockCandidateSave).not.toHaveBeenCalled();
    });
});

/**
 * HTTP: se mockea solo el servicio para no tocar Prisma; se valida recepción JSON y contrato de respuesta.
 * jest.resetModules + doMock permite coexists con tests que usan addCandidate real arriba: este bloque va al final.
 */
describe("Familia A (HTTP) — recepción del body y respuesta POST /candidates", () => {
    async function buildAppWithMockedService(
        addCandidateImpl: (...args: unknown[]) => unknown
    ) {
        jest.resetModules();
        jest.doMock("../application/services/candidateService", () => ({
            addCandidate: jest.fn(addCandidateImpl),
        }));

        const expressMod = await import("express");
        const { default: candidateRoutes } = await import(
            "../routes/candidateRoutes"
        );
        const { addCandidate: addCandidateMock } = await import(
            "../application/services/candidateService"
        );

        const app = expressMod.default();
        app.use(expressMod.default.json());
        app.use("/candidates", candidateRoutes);

        return { app, addCandidateMock };
    }

    // Criterio: el body JSON del POST se entrega intacto al caso de uso (mismo objeto que mandó el formulario).
    it("given body JSON válido when POST /candidates then addCandidate recibe ese body", async () => {
        const payload = baseValidPayload();
        const inner = jest.fn(async (body: Record<string, unknown>) => ({
            id: 1,
            ...body,
        }));

        const { app, addCandidateMock } = await buildAppWithMockedService(
            (...args: unknown[]) =>
                inner(args[0] as Record<string, unknown>)
        );

        await supertest(app).post("/candidates").send(payload).expect(201);

        expect(addCandidateMock).toHaveBeenCalledTimes(1);
        expect(inner).toHaveBeenCalledWith(
            expect.objectContaining({ email: payload.email })
        );
    });

    // Criterio: éxito responde 201 y serializa exactamente lo devuelto por el servicio (comportamiento actual del route handler).
    it("given addCandidate resolve when POST /candidates then responde 201 con el cuerpo devuelto", async () => {
        const saved = { id: 7, ok: true };
        const { app } = await buildAppWithMockedService(async () => saved);

        const res = await supertest(app).post("/candidates").send(baseValidPayload());

        expect(res.status).toBe(201);
        expect(res.body).toEqual(saved);
    });

    // Criterio: error de dominio (Error) se interpreta como 400 + { message }, alineado con el manejo en candidateRoutes.
    it("given addCandidate lanza Error when POST /candidates then responde 400 con mensaje", async () => {
        const { app } = await buildAppWithMockedService(async () => {
            throw new Error("Invalid email");
        });

        const res = await supertest(app).post("/candidates").send(baseValidPayload());

        expect(res.status).toBe(400);
        expect(res.body).toEqual({ message: "Invalid email" });
    });

    // Criterio: fallos que no son instancia de Error siguen tratándose como 500 en esta ruta.
    it("given addCandidate lanza no-Error when POST /candidates then responde 500", async () => {
        const { app } = await buildAppWithMockedService(async () => {
            throw "boom";
        });

        const res = await supertest(app).post("/candidates").send(baseValidPayload());

        expect(res.status).toBe(500);
        expect(res.body).toEqual({ message: "An unexpected error occurred" });
    });
});
