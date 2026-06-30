def mean_absolute_deviation(numbers):
    if not numbers:
        return 0.0
    mean = sum(numbers) / len(numbers)
    return sum(abs(x - mean) for x in numbers) / len(numbers)