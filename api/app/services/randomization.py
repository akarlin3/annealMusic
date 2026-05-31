import hashlib
import random
import uuid
from typing import Any


def get_williams_latin_square(n: int) -> list[list[int]]:
    """Generates a Williams Latin Square of size n.

    For even n, returns an n x n matrix.
    For odd n, returns an n x 2n matrix (two squares joined).
    Each row is a balanced permutation of [0, ..., n-1].
    """
    if n <= 0:
        return []

    # First row of Williams Latin Square: 0, 1, n-1, 2, n-2, 3, n-3...
    row1 = []
    left = 0
    right = n - 1
    for i in range(n):
        if i % 2 == 0:
            row1.append(left)
            left += 1
        else:
            row1.append(right)
            right -= 1

    matrix = []
    # Generate rows by adding row index to each element modulo n
    for r in range(n):
        row = [(val + r) % n for val in row1]
        matrix.append(row)

    if n % 2 != 0:
        # For odd n, add the mirrored/reversed square to balance carryover
        matrix2 = []
        for r in range(n):
            row = [n - 1 - val for val in matrix[r]]
            matrix2.append(row)
        matrix.extend(matrix2)

    return matrix


def assign_condition(
    scheme: str,
    seed: str,
    subject_id: str,
    enrollment_rank: int,
    conditions: list[Any],
) -> dict[str, Any] | None:
    """Assigns a condition from the list using the specified scheme, seed, subject_id,

    and enrollment rank (number of previously enrolled participants).
    Returns the assigned condition dictionary.
    """
    if not conditions:
        return None

    n = len(conditions)

    # 1. Simple Randomization: Cryptographic hash mapping (unbalanced but independent)
    if scheme == "simple":
        hasher = hashlib.sha256(f"{seed}:{subject_id}".encode())
        idx = int(hasher.hexdigest(), 16) % n
        return conditions[idx]

    # 2. Williams Latin Square: Order-balanced cross-over sequence
    elif scheme == "latin-square":
        # Generate the Williams square matrix
        matrix = get_williams_latin_square(n)
        rows_count = len(matrix)
        if rows_count == 0:
            return None

        # Determine the row index for this participant
        row_idx = enrollment_rank % rows_count

        # For single-condition assignment, we map the first column of their row.
        # To make this unpredictable, we shuffle the condition mappings deterministically using the seed.
        mapping = list(range(n))
        random.Random(seed).shuffle(mapping)

        condition_idx = mapping[matrix[row_idx][0]]
        return conditions[condition_idx]

    # 3. Block Randomization: Perfect balance in blocks of size 2N or 4N
    elif scheme == "block-random":
        block_size = n * 2  # Block size defaults to 2N
        block_number = enrollment_rank // block_size
        position_in_block = enrollment_rank % block_size

        # Generate the randomized block deterministically based on seed + block number
        block_seed = f"{seed}:block:{block_number}"
        rng = random.Random(block_seed)

        # Create balanced pool of condition indices (each index appears block_size / N times)
        multiplier = block_size // n
        pool = list(range(n)) * multiplier
        rng.shuffle(pool)

        condition_idx = pool[position_in_block]
        return conditions[condition_idx]

    # Fallback to simple
    hasher = hashlib.sha256(f"{seed}:{subject_id}".encode())
    idx = int(hasher.hexdigest(), 16) % n
    return conditions[idx]
